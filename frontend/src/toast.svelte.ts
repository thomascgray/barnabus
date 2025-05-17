import { animate, spring } from "motion";

export const toast = (message: string, type?: "success" | "error" | "info") => {
  const toast = document.createElement("div");
  const toastText = document.createElement("p");
  toastText.innerText = message;
  switch (type) {
    case "success":
      toast.style.backgroundColor = "#27ae60";
      break;
    case "error":
      toast.style.backgroundColor = "#e74c3c";
      break;
    case "info":
    default:
      toast.style.backgroundColor = "#3498db";
      break;
  }
  toast.className =
    "toast absolute bottom-0 left-0 pointer-events-none p-4 m-4 text-white rounded-lg text-sm";
  toast.appendChild(toastText);
  document.body.appendChild(toast);

  const toastRect = toast.getBoundingClientRect();
  toast.style.transform = `translateY(${toastRect.height}px)`;

  animate(
    toast,
    { y: [toastRect.height, 0] },
    { duration: 0.1, endDelay: 3, easing: spring() }
  ).finished.then(() => {
    animate(toast, { y: [0, 200] }, { duration: 0.3 });
  });
};
