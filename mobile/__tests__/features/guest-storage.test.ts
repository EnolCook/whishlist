import {
  claimsFor,
  clearGuestAccess,
  forgetReservation,
  forgetUnlock,
  saveClaim,
  saveUnlock,
  unlockTokenFor,
} from "@/features/guest/storage";

const DAY = 24 * 60 * 60 * 1000;

beforeEach(clearGuestAccess);

test("jeton de déverrouillage : gardé par liste jusqu'à son expiration, puis oublié", async () => {
  await saveUnlock("rt", "unlock-1", new Date(Date.now() + 14 * DAY).toISOString());
  await saveUnlock("old", "unlock-2", new Date(Date.now() - 1000).toISOString());
  expect(await unlockTokenFor("rt")).toBe("unlock-1");
  expect(await unlockTokenFor("old")).toBeNull();
  expect(await unlockTokenFor("autre")).toBeNull();
  await forgetUnlock("rt");
  expect(await unlockTokenFor("rt")).toBeNull();
});

test("claims : 90 jours, par liste, retirés après annulation", async () => {
  await saveClaim("rt", "r1", "claim-1");
  await saveClaim("rt", "r2", "claim-2");
  await saveClaim("autre", "r3", "claim-3");
  await saveClaim("rt", "r-old", "claim-old", Date.now() - 91 * DAY);
  expect(await claimsFor("rt")).toEqual(["claim-2", "claim-1"]);
  await forgetReservation("r2");
  expect(await claimsFor("rt")).toEqual(["claim-1"]);
  expect(await claimsFor("autre")).toEqual(["claim-3"]);
});

test("clearGuestAccess vide tout", async () => {
  await saveUnlock("rt", "unlock-1", new Date(Date.now() + DAY).toISOString());
  await saveClaim("rt", "r1", "claim-1");
  await clearGuestAccess();
  expect(await unlockTokenFor("rt")).toBeNull();
  expect(await claimsFor("rt")).toEqual([]);
});
