import { createApp, reactive } from "vue";
import App from "./App.vue";
import "./style.css";

const catalog = typeof __CATALOG__ !== "undefined" ? __CATALOG__ : { modules: [], core: [] };

const state = reactive({
  view: "modules",
  currentModule: null,
  currentSaga: null,
  query: "",
  catalog,
});

createApp(App, { state }).mount("#app");
