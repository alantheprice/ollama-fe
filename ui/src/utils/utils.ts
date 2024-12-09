
export const classNames = (classes: { [key: string]: boolean }) =>
    Object.entries(classes)
      .filter(([, value]) => value)
      .map(([key]) => key)
      .join(" ");
  
  export const qs = (selector: string) => document.querySelector(selector);
  export const qsAll = (selector: any) =>
    Array.from(document.querySelectorAll(selector));