import * as React from "react";

const TOAST_LIMIT = 5;
const TOAST_REMOVE_DELAY = 4000;

type ToastActionElement = React.ReactElement;

export type Toast = {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
  variant?: "default" | "destructive" | "success";
  duration?: number;
};

type ToastState = {
  toasts: Toast[];
};

type Action =
  | { type: "ADD_TOAST"; toast: Toast }
  | { type: "REMOVE_TOAST"; toastId: string }
  | { type: "UPDATE_TOAST"; toast: Partial<Toast> & { id: string } };

let count = 0;
function genId() {
  count = (count + 1) % Number.MAX_VALUE;
  return count.toString();
}

const listeners: Array<(state: ToastState) => void> = [];
let memoryState: ToastState = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach(listener => listener(memoryState));
}

function reducer(state: ToastState, action: Action): ToastState {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };
    case "REMOVE_TOAST":
      return {
        ...state,
        toasts: state.toasts.filter(t => t.id !== action.toastId),
      };
    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map(t => t.id === action.toast.id ? { ...t, ...action.toast } : t),
      };
    default:
      return state;
  }
}

function toast(props: Omit<Toast, "id">) {
  const id = genId();
  const duration = props.duration ?? TOAST_REMOVE_DELAY;

  dispatch({ type: "ADD_TOAST", toast: { ...props, id } });
  setTimeout(() => dispatch({ type: "REMOVE_TOAST", toastId: id }), duration);
  return id;
}

export function useToast() {
  const [state, setState] = React.useState<ToastState>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) listeners.splice(index, 1);
    };
  }, []);

  return {
    toasts: state.toasts,
    toast,
    dismiss: (toastId: string) => dispatch({ type: "REMOVE_TOAST", toastId }),
  };
}

export { toast };
