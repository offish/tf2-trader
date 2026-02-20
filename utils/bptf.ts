export { getUrlParam, parseIds } from "./index";

let toastTimeout: ReturnType<typeof setTimeout> | null = null;

export function showToast(message: string, isError = false): void {
  let toast = document.getElementById("stoe-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "stoe-toast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.style.borderColor = isError ? "#a04040" : "#4a7ab5";
  toast.classList.add("visible");

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast!.classList.remove("visible");
  }, 3000);
}
