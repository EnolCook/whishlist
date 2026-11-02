// Modules natifs remplacés pour jest.
jest.mock("@react-native-community/netinfo", () => require("@react-native-community/netinfo/jest/netinfo-mock.js"));

jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    __store: store,
  };
});

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: () => {
    throw new Error("Les tests utilisent __tests__/helpers/memory-db.ts");
  },
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: { apiUrl: "https://api.example.test" } } },
}));

// Cache de l'app : de faux fichiers, par nom (`__cache`).
jest.mock("expo-file-system", () => {
  const cache = new Map<string, string>();
  class File {
    name: string;
    uri: string;
    constructor(_dir: unknown, name: string) {
      this.name = name;
      this.uri = `file:///cache/${name}`;
    }
    create() {
      cache.set(this.name, "");
    }
    async write(content: string) {
      cache.set(this.name, content);
    }
    delete() {
      cache.delete(this.name);
    }
  }
  return { File, Paths: { cache: { list: () => [...cache.keys()].map((name) => new File(null, name)) } }, __cache: cache };
});

jest.mock("expo-sharing", () => require("./helpers/sharing").sharingMock);
