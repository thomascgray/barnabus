import { mount } from "svelte";
import "./style.css";

import App from "./App.svelte";
import Landing from "./Landing.svelte";
import Container from "./Container.svelte";

const app = mount(Container, {
  target: document.getElementById("app")!,
});

export default app;
