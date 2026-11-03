import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Linking } from "react-native";

import MyLists from "../../app/(app)/index";
import FollowSharedList from "../../app/(app)/shared/follow";
import { signIn } from "@/auth/session";
import { resetStore } from "@/data/store";
import { i18n } from "@/i18n";

import { fakeFetch, json, me } from "../helpers/fetch";
import { freshDb } from "../helpers/memory-db";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: jest.fn(() => ({ readToken: "demo-list-lecture" })),
}));
// Caméra simulée (US4) : le viseur garde son `onBarcodeScanned` pour que le test « montre » un QR code.
const camera: {
  permission: { granted: boolean; canAskAgain: boolean };
  grantOnRequest: boolean;
  onScanned: ((event: { data: string }) => void) | null;
} = { permission: { granted: false, canAskAgain: true }, grantOnRequest: true, onScanned: null };
jest.mock("expo-camera", () => {
  const { View } = require("react-native");
  return {
    CameraView: (props: { testID?: string; onBarcodeScanned: (event: { data: string }) => void }) => {
      camera.onScanned = props.onBarcodeScanned;
      return <View testID={props.testID} />;
    },
    useCameraPermissions: () => [
      camera.permission,
      async () => {
        camera.permission = { granted: camera.grantOnRequest, canAskAgain: false };
        return camera.permission;
      },
    ],
  };
});
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { version: "1.0.0", extra: { apiUrl: "https://api.example.test" } } },
}));

const sharedSummary = {
  id: "demo-list",
  readToken: "demo-list-lecture",
  title: "Liste de Camille",
  subtitle: "Pour les fêtes",
  coverImageUrl: null,
  theme: {},
  itemCount: 2,
  readUrl: "https://ohyoushouldnt.example.test/l/demo-list-lecture",
  subscribedAt: "2026-11-02T10:00:00.000Z",
  locked: false,
};

beforeEach(async () => {
  camera.permission = { granted: false, canAskAgain: true };
  camera.grantOnRequest = true;
  camera.onScanned = null;
  await freshDb();
  resetStore();
  await i18n.changeLanguage("fr");
  jest.clearAllMocks();
  jest.mocked(useLocalSearchParams).mockReturnValue({ readToken: "demo-list-lecture" });
  await signIn({ token: "secret-token", expiresAt: "2099-01-01T00:00:00.000Z", user: me });
});

test("MyLists renders the followed lists section and opens the follow screen or a followed list", async () => {
  fakeFetch({
    "GET /lists": () => json(200, { lists: [], subscriptions: [sharedSummary] }),
  });
  await render(<MyLists />);
  expect(await screen.findByText("Listes suivies")).toBeOnTheScreen();
  expect(await screen.findByText("Liste de Camille")).toBeOnTheScreen();

  await fireEvent.press(screen.getByTestId("lists.follow-open"));
  expect(router.push).toHaveBeenCalledWith("/shared/follow");

  await fireEvent.press(screen.getByTestId("lists.shared-card-demo-list-lecture"));
  expect(router.push).toHaveBeenCalledWith("/guest/demo-list-lecture");
});

test("FollowSharedList handles link submission and 423 password prompt", async () => {
  let step = 0;
  fakeFetch({
    "POST /subscriptions": async (req) => {
      const body = (await req.json()) as { urlOrToken: string; password?: string };
      if (++step === 1) {
        return json(423, {
          error: { code: "readPasswordRequired", message: "Mot de passe requis" },
          title: "Liste de Camille",
          readToken: "demo-list-lecture",
        });
      }
      expect(body.password).toBe("secret-1234");
      return json(201, sharedSummary);
    },
    "GET /lists": () => json(200, { lists: [], subscriptions: [sharedSummary] }),
  });

  await render(<FollowSharedList />);
  await fireEvent.changeText(
    screen.getByTestId("follow.link"),
    "https://ohyoushouldnt.app/l/demo-list-lecture",
  );
  await fireEvent.press(screen.getByTestId("follow.submit"));

  // Le champ mot de passe et le titre de la liste apparaissent après 423
  expect(await screen.findByText("Liste de Camille")).toBeOnTheScreen();
  const pwdInput = await screen.findByTestId("follow.password");
  await fireEvent.changeText(pwdInput, "secret-1234");
  await fireEvent.press(screen.getByTestId("follow.submit"));

  await waitFor(() => {
    expect(router.replace).toHaveBeenCalledWith("/guest/demo-list-lecture");
  });
});

test("FollowSharedList shows an error when the link is invalid or user is already a member", async () => {
  fakeFetch({
    "POST /subscriptions": () =>
      json(400, { error: { code: "alreadyMember", message: "Vous faites déjà partie des membres de cette liste." } }),
  });

  await render(<FollowSharedList />);
  // Lien vide refusé localement
  await fireEvent.press(screen.getByTestId("follow.submit"));
  expect(await screen.findByText("Saisissez le lien valide d'une liste partagée.")).toBeOnTheScreen();

  // Lien d'une liste dont on est déjà membre
  await fireEvent.changeText(screen.getByTestId("follow.link"), "demo-list-lecture");
  await fireEvent.press(screen.getByTestId("follow.submit"));
  expect(await screen.findByText("Vous faites déjà partie des membres de cette liste.")).toBeOnTheScreen();
});

async function scan(data: string) {
  await act(async () => camera.onScanned!({ data }));
}

test("FollowSharedList (US4): scanning a list's QR code follows it and opens the list", async () => {
  let sent: unknown = null;
  fakeFetch({
    "POST /subscriptions": async (request) => {
      sent = await request.json();
      return json(201, sharedSummary);
    },
    "GET /lists": () => json(200, { lists: [], subscriptions: [sharedSummary] }),
  });
  await render(<FollowSharedList />);
  await fireEvent.press(screen.getByTestId("follow.scan"));
  expect(await screen.findByTestId("follow.camera")).toBeOnTheScreen();

  await scan("https://ohyoushouldnt.example.test/l/demo-list-lecture");
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/guest/demo-list-lecture"));
  expect(sent).toEqual({ urlOrToken: "https://ohyoushouldnt.example.test/l/demo-list-lecture" });
});

test("FollowSharedList (US4): another QR code is refused on the phone and scanning goes on", async () => {
  const { calls } = fakeFetch({});
  await render(<FollowSharedList />);
  await fireEvent.press(screen.getByTestId("follow.scan"));
  await screen.findByTestId("follow.camera");

  await scan("https://example.test/menu-du-jour");
  expect(await screen.findByText("Ce QR code n'est pas le lien d'une liste.")).toBeOnTheScreen();
  expect(screen.getByTestId("follow.camera")).toBeOnTheScreen();
  expect(calls).toEqual([]);
});

test("FollowSharedList (US4): a protected list's QR code asks for its password", async () => {
  fakeFetch({
    "POST /subscriptions": () =>
      json(423, {
        error: { code: "readPasswordRequired", message: "Mot de passe requis" },
        title: "Liste de Camille",
        readToken: "demo-list-lecture",
      }),
  });
  await render(<FollowSharedList />);
  await fireEvent.press(screen.getByTestId("follow.scan"));
  await screen.findByTestId("follow.camera");
  await scan("ohyoushouldnt://l/demo-list-lecture");
  expect(await screen.findByTestId("follow.password")).toBeOnTheScreen();
  expect(screen.getByTestId("follow.locked-title")).toHaveTextContent("Liste de Camille");
  expect(screen.queryByTestId("follow.camera")).toBeNull();
});

test("FollowSharedList (US4): camera refused, a message points to the settings and pasting still works", async () => {
  camera.grantOnRequest = false;
  const openSettings = jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
  await render(<FollowSharedList />);
  await fireEvent.press(screen.getByTestId("follow.scan"));
  expect(await screen.findByTestId("follow.camera-denied")).toBeOnTheScreen();
  expect(screen.queryByTestId("follow.camera")).toBeNull();
  await fireEvent.press(screen.getByTestId("follow.open-settings"));
  expect(openSettings).toHaveBeenCalled();
  expect(screen.getByTestId("follow.link")).toBeOnTheScreen();
});
