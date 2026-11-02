import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, Animated, Keyboard, StyleSheet } from "react-native";

import { i18n } from "@/i18n";

import { ListThemeProvider } from "@/theme/ListTheme";
import { tokens } from "@/theme/tokens";
import { Badge } from "@/ui/Badge";
import { Button, type ButtonVariant } from "@/ui/Button";
import { Card, CollapsibleCard } from "@/ui/Card";
import { Checkbox } from "@/ui/Checkbox";
import { Input } from "@/ui/Input";
import { PillTabs } from "@/ui/PillTabs";
import { Text } from "@/ui/Text";
import { Textarea } from "@/ui/Textarea";

function style(testID: string) {
  return StyleSheet.flatten(screen.getByTestId(testID).props.style);
}

/** L'ombre du site : une vue noire pleine, décalée de 4/4. */
function expectShadow(testID: string) {
  expect(style(`${testID}-shadow`)).toMatchObject({
    position: "absolute",
    top: tokens.shadowOffset,
    left: tokens.shadowOffset,
    backgroundColor: tokens.colors.black,
  });
}

describe("Button", () => {
  const backgrounds: [ButtonVariant, string][] = [
    ["default", tokens.colors.giftBlue],
    ["neutral", tokens.colors.white],
    ["destructive", tokens.colors.destructive],
  ];

  test.each(backgrounds)("%s: background, 2px border and offset shadow", async (variant, background) => {
    await render(<Button title="OK" variant={variant} testID="button" />);
    expect(style("button-box")).toMatchObject({
      backgroundColor: background,
      borderWidth: tokens.borderWidth,
      borderColor: tokens.colors.black,
      borderRadius: tokens.radius,
    });
    expectShadow("button-box");
  });

  test("link: underlined text, no box", async () => {
    await render(<Button title="Mot de passe oublié ?" variant="link" testID="button" />);
    expect(screen.queryByTestId("button-box")).toBeNull();
    expect(StyleSheet.flatten(screen.getByText("Mot de passe oublié ?").props.style)).toMatchObject({
      textDecorationLine: "underline",
    });
  });

  test("disabled: half opacity", async () => {
    await render(<Button title="OK" disabled testID="button" />);
    expect(style("button")).toMatchObject({ opacity: 0.5 });
    expect(screen.getByRole("button")).toBeDisabled();
  });

  test("sinks by 4/4 and loses its shadow while pressed, then comes back", async () => {
    await render(<Button title="OK" testID="button" onPress={() => {}} />);
    await fireEvent(screen.getByTestId("button"), "pressIn");
    expect(style("button-box").transform).toEqual([
      { translateX: tokens.shadowOffset },
      { translateY: tokens.shadowOffset },
    ]);
    expect(screen.queryByTestId("button-box-shadow")).toBeNull();
    await fireEvent(screen.getByTestId("button"), "pressOut");
    expect(style("button-box").transform).toBeUndefined();
    expectShadow("button-box");
  });

  test("takes the list theme's primary colour", async () => {
    await render(
      <ListThemeProvider theme={{ primary: "#00a86b" }}>
        <Button title="OK" testID="button" />
      </ListThemeProvider>,
    );
    expect(style("button-box")).toMatchObject({ backgroundColor: "#00a86b" });
  });
});

test("Card, Input and Badge have the border and the shadow", async () => {
  await render(
    <>
      <Card testID="card">
        <Text>Contenu</Text>
      </Card>
      <Input accessibilityLabel="Nom" />
      <Badge testID="badge">24,90 €</Badge>
    </>,
  );
  for (const id of ["card", "badge"]) {
    expect(style(id)).toMatchObject({ borderWidth: tokens.borderWidth, borderColor: tokens.colors.black });
    expectShadow(id);
  }
  const input = screen.getByLabelText("Nom");
  expect(StyleSheet.flatten(input.props.style)).toMatchObject({ fontSize: tokens.fontSize.base });
});

test("Badge: height 24, 12px bold text", async () => {
  await render(<Badge testID="badge">Alex</Badge>);
  const inner = screen.getByTestId("badge").children[0];
  expect(typeof inner === "object" && StyleSheet.flatten(inner.props.style)).toMatchObject({
    minHeight: 24 - 2 * tokens.borderWidth,
  });
  expect(StyleSheet.flatten(screen.getByText("Alex").props.style)).toMatchObject({
    fontSize: 12,
    fontFamily: "Geist_700Bold",
  });
});

test("PillTabs: the active tab is blue with white text", async () => {
  await render(
    <PillTabs
      tabs={[
        { key: "ideas", label: "Idées (8)" },
        { key: "archives", label: "Archives (1)" },
      ]}
      active="ideas"
      onChange={() => {}}
    />,
  );
  expect(style("tab-ideas-box")).toMatchObject({ backgroundColor: tokens.colors.giftBlue });
  expect(StyleSheet.flatten(screen.getByText("Idées (8)").props.style)).toMatchObject({ color: tokens.colors.white });
  expect(style("tab-archives-box")).toMatchObject({ backgroundColor: tokens.colors.white });
  expect(screen.getAllByRole("tab")[0]).toBeSelected();
});

describe("CollapsibleCard", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("fr");
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function renderCard(props: { defaultExpanded?: boolean; onAction?: () => void } = {}) {
    await render(
      <CollapsibleCard testID="card" title="Profil" description="Votre nom." defaultExpanded={props.defaultExpanded}>
        <Input accessibilityLabel="Nom" />
        <Button title="Enregistrer" onPress={props.onAction ?? (() => {})} />
      </CollapsibleCard>,
    );
  }

  function expectCollapsed(collapsed: boolean) {
    const toggle = screen.getByTestId("card-toggle");
    expect(toggle.props.accessibilityState).toMatchObject({ expanded: !collapsed });
    expect(toggle.props.accessibilityHint).toBe(collapsed ? "Déplier" : "Replier");
    const content = screen.getByTestId("card-content", { includeHiddenElements: true });
    // Caché aux lecteurs d'écran : introuvable pour une requête qui imite un lecteur d'écran.
    expect(screen.queryByLabelText("Nom")).toBe(collapsed ? null : screen.getByLabelText("Nom"));
    expect(content.props.accessibilityElementsHidden).toBe(collapsed);
    expect(content.props.importantForAccessibility).toBe(collapsed ? "no-hide-descendants" : "auto");
    expect(content.props.pointerEvents).toBe(collapsed ? "none" : "auto");
  }

  test("collapsed by default: title and description shown, header is a button, content hidden", async () => {
    await renderCard();
    expect(screen.getByText("Profil")).toBeOnTheScreen();
    expect(screen.getByText("Votre nom.")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Profil" })).toBe(screen.getByTestId("card-toggle"));
    expectCollapsed(true);
  });

  test("defaultExpanded: open on mount", async () => {
    await renderCard({ defaultExpanded: true });
    expectCollapsed(false);
  });

  test("the header toggles the card; a button in the content does not", async () => {
    const onAction = jest.fn();
    await renderCard({ onAction });
    await fireEvent.press(screen.getByTestId("card-toggle"));
    expectCollapsed(false);
    await fireEvent.press(screen.getByRole("button", { name: "Enregistrer" }));
    expect(onAction).toHaveBeenCalled();
    expectCollapsed(false);
    await fireEvent.press(screen.getByTestId("card-toggle"));
    expectCollapsed(true);
  });

  test("the content stays mounted: typed text survives a collapse", async () => {
    await renderCard({ defaultExpanded: true });
    await fireEvent.changeText(screen.getByLabelText("Nom"), "Alexandra");
    await fireEvent.press(screen.getByTestId("card-toggle"));
    await fireEvent.press(screen.getByTestId("card-toggle"));
    expect(screen.getByDisplayValue("Alexandra")).toBeOnTheScreen();
  });

  test("collapsing dismisses the keyboard", async () => {
    const dismiss = jest.spyOn(Keyboard, "dismiss");
    await renderCard({ defaultExpanded: true });
    await fireEvent.press(screen.getByTestId("card-toggle"));
    expect(dismiss).toHaveBeenCalled();
  });

  test("animates in 200 ms", async () => {
    const timing = jest.spyOn(Animated, "timing");
    await renderCard();
    await fireEvent.press(screen.getByTestId("card-toggle"));
    expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 1, duration: 200 }));
  });

  test("reduce motion: no animation, the state still changes", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    const timing = jest.spyOn(Animated, "timing");
    await renderCard();
    await fireEvent.press(screen.getByTestId("card-toggle"));
    expect(timing).not.toHaveBeenCalled();
    expectCollapsed(false);
  });

  test("quick repeated taps: the animation goes to the last requested state", async () => {
    const timing = jest.spyOn(Animated, "timing");
    await renderCard();
    await fireEvent.press(screen.getByTestId("card-toggle"));
    await fireEvent.press(screen.getByTestId("card-toggle"));
    expect(timing).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ toValue: 0, duration: 200 }));
    expectCollapsed(true);
  });

  test("tapping a field of the open card does not collapse it", async () => {
    await renderCard({ defaultExpanded: true });
    await fireEvent(screen.getByLabelText("Nom"), "focus");
    await fireEvent.press(screen.getByLabelText("Nom"));
    expectCollapsed(false);
  });

  test("the chevron points down when collapsed, up when expanded", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    await renderCard();
    const rotation = () => StyleSheet.flatten(screen.getByTestId("card-chevron").props.style).transform;
    expect(rotation()).toEqual([{ rotate: "0deg" }]);
    await fireEvent.press(screen.getByTestId("card-toggle"));
    expect(rotation()).toEqual([{ rotate: "180deg" }]);
  });

  test("reduce motion turned on while the screen is open: the next toggle is not animated", async () => {
    let onChange: ((reduced: boolean) => void) | undefined;
    jest.spyOn(AccessibilityInfo, "addEventListener").mockImplementation((_event, listener) => {
      onChange = listener as (reduced: boolean) => void;
      return { remove: () => {} } as ReturnType<typeof AccessibilityInfo.addEventListener>;
    });
    const timing = jest.spyOn(Animated, "timing");
    await renderCard();
    await act(() => onChange?.(true));
    await fireEvent.press(screen.getByTestId("card-toggle"));
    expect(timing).not.toHaveBeenCalled();
    expectCollapsed(false);
  });

  test("the open card follows the height of its content (an alert that appears)", async () => {
    await renderCard({ defaultExpanded: true });
    const measure = screen.getByTestId("card-content-measure");
    await fireEvent(measure, "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 120 } } });
    expect(StyleSheet.flatten(screen.getByTestId("card-content").props.style).height).toBe(120);
    await fireEvent(measure, "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 180 } } });
    expect(StyleSheet.flatten(screen.getByTestId("card-content").props.style).height).toBe(180);
  });

  test("contentStyle goes to the content of the card", async () => {
    await render(
      <CollapsibleCard testID="card" title="Liens" defaultExpanded contentStyle={{ alignItems: "flex-start" }}>
        <Text>Mentions légales</Text>
      </CollapsibleCard>,
    );
    const content = screen.getByTestId("card-content-measure").children[0];
    expect(typeof content === "object" && StyleSheet.flatten(content.props.style)).toMatchObject({ alignItems: "flex-start" });
  });

  test("keeps the box of Card", async () => {
    await renderCard();
    expect(style("card")).toMatchObject({ borderWidth: tokens.borderWidth, borderColor: tokens.colors.black });
    expectShadow("card");
  });
});

describe("Checkbox", () => {
  test("20px box with the border and the shadow, white until checked", async () => {
    await render(<Checkbox testID="check" checked={false} onChange={() => {}} label="L’occasion me va" />);
    expect(style("check-box")).toMatchObject({ width: 20, height: 20, backgroundColor: tokens.colors.white });
    expectShadow("check-box");
    expect(screen.getByTestId("check").props.accessibilityState).toMatchObject({ checked: false });
  });

  test("checked: filled with the main colour, announced as checked", async () => {
    await render(<Checkbox testID="check" checked onChange={() => {}} label="L’occasion me va" />);
    expect(style("check-box").backgroundColor).not.toBe(tokens.colors.white);
    expect(screen.getByTestId("check").props.accessibilityState).toMatchObject({ checked: true });
  });

  test("the whole row toggles, at least one touch target tall", async () => {
    const onChange = jest.fn();
    await render(<Checkbox testID="check" checked={false} onChange={onChange} label="L’occasion me va" description="Aide" />);
    fireEvent.press(screen.getByText("L’occasion me va"));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(StyleSheet.flatten(screen.getByTestId("check").props.style).minHeight).toBeGreaterThanOrEqual(tokens.touchTarget);
  });
});

test("Textarea: an Input on several lines, at least 64 high, text from the top", async () => {
  await render(<Textarea accessibilityLabel="Description" />);
  const field = screen.getByLabelText("Description");
  expect(field.props.multiline).toBe(true);
  expect(field.props.textAlignVertical).toBe("top");
  expect(StyleSheet.flatten(field.props.style)).toMatchObject({ minHeight: 64, fontSize: tokens.fontSize.base });
});
