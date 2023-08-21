function toggleDarkMode(theme) {
  if (window.matchMedia(`(prefers-color-scheme: dark)`).matches) {
    document.documentElement.setAttribute(`data-theme`, theme);
  } else {
    document.documentElement.removeAttribute(`data-theme`);
  }
}

document.addEventListener(`DOMContentLoaded`, () => {
  toggleDarkMode("forest");
  window
    .matchMedia(`(prefers-color-scheme: dark)`)
    .addEventListener(`change`, () => {
      toggleDarkMode("forest");
    });
});
