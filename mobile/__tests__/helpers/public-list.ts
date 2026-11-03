/** Liste publique (vue invité, 011) : deux catégories, une personne, des idées libres par défaut. */
export const publicItem = (id: string, typeId: string, extra: object = {}) => ({
  id,
  name: `Idée ${id}`,
  typeId,
  personId: "p",
  url: null,
  imageUrl: null,
  priceCents: 1990,
  priceLabel: "19,90 €",
  priority: null,
  mine: false,
  reservationId: null,
  ...extra,
});

export const publicList = (items = [publicItem("i1", "t1"), publicItem("i2", "t2")]) => ({
  title: "Liste d'Alex",
  subtitle: null,
  coverImageUrl: null,
  theme: { preset: "default" },
  subscribed: false,
  isMember: false,
  categories: [
    { id: "t1", label: "Jeux", sortOrder: 0 },
    { id: "t2", label: "Livres", sortOrder: 1 },
  ],
  people: [{ id: "p", label: "Alex" }],
  items,
});
