export const invoke = jest.fn();
export const Channel = class {
  onmessage?: (event: unknown) => void;
};
