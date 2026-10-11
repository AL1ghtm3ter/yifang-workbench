const parentOrigin = new URL(location.href).origin;
addEventListener("message", (event) => {
  if (
    event.source !== parent ||
    event.origin !== parentOrigin ||
    !event.data ||
    event.data.type !== "yifang:theme" ||
    event.data.version !== 1
  )
    return;
  const { theme, readingSize } = event.data;
  if (
    !["light", "dark"].includes(theme) ||
    ![16, 18, 20, 22].includes(readingSize)
  )
    return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.setProperty("--size", readingSize + "px");
  document.getElementById("bridgeStatus").textContent =
    "主题已同步：" + theme + "；阅读字号：" + readingSize + "px";
});
if (parent !== window)
  parent.postMessage({ type: "yifang:ready", version: 1 }, parentOrigin);
