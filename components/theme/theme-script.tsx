/** Inline before paint to avoid theme flash (reads zustand persist key). */
export function ThemeScript() {
  const script = `(function(){try{var raw=localStorage.getItem("strideiq-theme-v1");var parsed=raw&&JSON.parse(raw);var theme=(parsed&&parsed.state&&parsed.state.theme)||"dark";var root=document.documentElement;root.classList.remove("light","dark");root.classList.add(theme==="light"?"light":"dark");root.style.colorScheme=theme==="light"?"light":"dark";}catch(e){document.documentElement.classList.add("dark");}})();`;

  return <script dangerouslySetInnerHTML={{ __html: script }} suppressHydrationWarning />;
}
