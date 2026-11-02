import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { AccessibilityInfo, Animated } from "react-native";

import { reorderTypes } from "@/data/labels";

import { IdeasAccordion } from "@/features/items/IdeasAccordion";
import { i18n } from "@/i18n";
import type { ViewItem, ViewList } from "@/offline/optimistic";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/data/labels", () => ({ reorderTypes: jest.fn(async () => {}) }));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

const item: ViewItem = {
  id: "gift",
  name: "Livre",
  typeId: "books",
  personId: "p",
  url: null,
  imageUrl: null,
  priceCents: 1990,
  priceLabel: "19,90 €",
  priority: null, secondHandOk: false, description: null,
  archived: false,
  sortOrder: 0,
  pending: false,
  rejected: null,
};

const list: ViewList = {
  id: "w",
  title: "Nos envies",
  subtitle: null,
  coverImageUrl: null,
  theme: {},
  role: "owner",
  readUrl: "https://ohyoushouldnt.example.test/l/rt",
  inviteUrl: "https://ohyoushouldnt.example.test/i/it",
  hasReadPassword: false,
  categories: [
    { id: "books", label: "Livres", sortOrder: 0 },
    { id: "games", label: "Jeux", sortOrder: 1 },
  ],
  people: [{ id: "p", label: "Alex" }],
  items: [item],
  reservations: [],
  members: [],
  pending: false,
  rejected: null,
  localOnly: false,
};

beforeEach(async () => {
  await i18n.changeLanguage("fr");
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
});

afterEach(() => {
  jest.restoreAllMocks();
});

function expanded(id: string): boolean {
  return Boolean(screen.getByTestId(`list.category-${id}`).props.accessibilityState?.expanded);
}

test("categories open collapsed, their ideas not mounted, then unfold with the animation of the accordion (009)", async () => {
  const timing = jest.spyOn(Animated, "timing");
  await render(<IdeasAccordion list={list} />);
  expect(expanded("books")).toBe(false);
  expect(screen.getByTestId("list.category-books").props.accessibilityHint).toBe("Déplier");
  // Repliée : ses idées ne sont pas montées (liste légère, aucun bouton caché).
  expect(screen.queryByText("Livre", { includeHiddenElements: true })).toBeNull();

  await fireEvent.press(screen.getByTestId("list.category-books"));
  expect(expanded("books")).toBe(true);
  expect(screen.getByTestId("list.category-books").props.accessibilityHint).toBe("Replier");
  expect(screen.getByText("Livre")).toBeOnTheScreen();
  expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 1, duration: 200 }));

  await fireEvent.press(screen.getByTestId("list.category-books"));
  expect(expanded("books")).toBe(false);
  expect(timing).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ toValue: 0, duration: 200 }));
  // Pendant le repli, le contenu est déjà caché aux lecteurs d'écran et aux appuis.
  expect(screen.queryByText("Livre")).toBeNull();
  expect(screen.getByTestId("list.category-books-content", { includeHiddenElements: true }).props.pointerEvents).toBe("none");
});

test("reduce motion: no animation, and the ideas leave as soon as the category is collapsed", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
  const timing = jest.spyOn(Animated, "timing");
  await render(<IdeasAccordion list={list} />);
  await fireEvent.press(screen.getByTestId("list.category-books"));
  expect(screen.getByText("Livre")).toBeOnTheScreen();
  const chevron = () => StyleSheet.flatten(screen.getByTestId("list.category-books-chevron").props.style).transform;
  expect(chevron()).toEqual([{ rotate: "180deg" }]);
  await fireEvent.press(screen.getByTestId("list.category-books"));
  expect(screen.queryByText("Livre", { includeHiddenElements: true })).toBeNull();
  expect(chevron()).toEqual([{ rotate: "0deg" }]);
  expect(timing).not.toHaveBeenCalled();
});

test("each category has its own state; an empty one shows its hint once unfolded", async () => {
  await render(<IdeasAccordion list={list} />);
  await fireEvent.press(screen.getByTestId("list.category-games"));
  expect(expanded("games")).toBe(true);
  expect(expanded("books")).toBe(false);
  expect(screen.getByText(i18n.t("list:accordion.emptyCategory"))).toBeOnTheScreen();
});

test("the order arrows work on a collapsed category", async () => {
  await render(<IdeasAccordion list={list} />);
  await fireEvent.press(screen.getByRole("button", { name: i18n.t("list:accordion.moveUp", { name: "Jeux" }) }));
  expect(reorderTypes).toHaveBeenCalledWith("w", ["games", "books"]);
  expect(expanded("games")).toBe(false);
});

test("an open category stays open at its new place after a reorder", async () => {
  await render(<IdeasAccordion list={list} />);
  await fireEvent.press(screen.getByTestId("list.category-books"));
  const reordered: ViewList = {
    ...list,
    categories: [
      { id: "books", label: "Livres", sortOrder: 1 },
      { id: "games", label: "Jeux", sortOrder: 0 },
    ],
  };
  await screen.rerender(<IdeasAccordion list={reordered} />);
  expect(expanded("books")).toBe(true);
  expect(screen.getByText("Livre")).toBeOnTheScreen();
});

test("an open category follows the height of its content (an idea added)", async () => {
  // Sans animation : la catégorie est tout de suite à sa hauteur dépliée.
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
  await render(<IdeasAccordion list={list} />);
  await fireEvent.press(screen.getByTestId("list.category-books"));
  const measure = () => screen.getByTestId("list.category-books-content-measure");
  const height = () => StyleSheet.flatten(screen.getByTestId("list.category-books-content").props.style).height;
  await fireEvent(measure(), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 200 } } });
  expect(height()).toBe(200);
  await screen.rerender(<IdeasAccordion list={{ ...list, items: [...list.items, { ...item, id: "gift2", name: "Roman", sortOrder: 1 }] }} />);
  expect(screen.getByText("Roman")).toBeOnTheScreen();
  await fireEvent(measure(), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 380 } } });
  expect(height()).toBe(380);
});
