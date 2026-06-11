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
  loaded: false,
});

const app = createApp(App, { state });
app.mount("#app");

// Load catalog and adapters at runtime (not bundled)
async function loadData() {
  try {
    const [cat, adp] = await Promise.all([
      fetch("./catalog.json").then(r => r.json()),
      fetch("./adapters.json").then(r => r.json()),
    ]);
    state.catalog = cat;
    state.adapters = adp;
    state.loaded = true;
  } catch (e) {
    console.error("Failed to load catalog data", e);
    state.loaded = true;
    state.catalogError = "Could not load catalog.json. Make sure the site was built with 'npm run docs' from the project root.";
  }
}
loadData();
