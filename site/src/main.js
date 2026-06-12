import { createApp, reactive } from "vue";
import App from "./App.vue";
import "./style.css";

const state = reactive({
  view: "home",
  currentModule: null,
  currentSaga: null,
  query: "",
  catalog: { modules: [], core: [] },
  adapters: [],
  entities: [],
  sagas: [],
  loaded: false,
});

const app = createApp(App, { state });
app.mount("#app");

// Load catalog, adapters, entities, and sagas at runtime (not bundled)
async function loadData() {
  try {
    const [cat, adp, ents, sgs] = await Promise.all([
      fetch("./catalog.json").then(r => r.json()),
      fetch("./adapters.json").then(r => r.json()),
      fetch("./entities.json").then(r => r.json()),
      fetch("./sagas.json").then(r => r.json()),
    ]);
    state.catalog = cat;
    state.adapters = adp;
    state.entities = ents;
    state.sagas = sgs;
    state.loaded = true;
  } catch (e) {
    console.error("Failed to load data", e);
    state.loaded = true;
  }
}
loadData();
