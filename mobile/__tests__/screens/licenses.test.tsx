import { fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, Animated } from "react-native";

import Licenses from "../../app/legal/licenses";
import { i18n } from "@/i18n";

import licenses from "@/legal/licenses.json";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true } }));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

const first = licenses[0];

beforeEach(async () => {
  await i18n.changeLanguage("fr");
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("a license shows its version and license; its text unfolds with the accordion animation (009)", async () => {
  const timing = jest.spyOn(Animated, "timing");
  await render(<Licenses />);
  expect(screen.getAllByText(`${first.version} · ${first.license}`)[0]).toBeOnTheScreen();
  // Replié : le texte (long) n'est pas monté.
  expect(screen.queryAllByText(first.text, { includeHiddenElements: true })).toHaveLength(0);

  const toggle = screen.getAllByRole("button").find((button) => button.props.accessibilityState?.expanded === false);
  expect(toggle).toBeDefined();
  expect(toggle!.props.accessibilityHint).toBe("Déplier");
  await fireEvent.press(toggle!);
  expect(screen.getAllByText(first.text)).toHaveLength(1);
  expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 1, duration: 200 }));
});
