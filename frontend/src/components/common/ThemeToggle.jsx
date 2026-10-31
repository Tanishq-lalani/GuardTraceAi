import useTheme from "../../context/useTheme";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === "light" ? "dark" : "light";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={`Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
    >
      <span aria-hidden="true">{theme === "light" ? "☾" : "☀"}</span>
      <span className="theme-toggle-label">{theme === "light" ? "Dark" : "Light"} mode</span>
    </button>
  );
}
