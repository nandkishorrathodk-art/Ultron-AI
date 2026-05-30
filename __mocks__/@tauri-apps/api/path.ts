export const downloadDir = jest.fn(() => Promise.resolve("/mock/downloads"));
export const appLocalDataDir = jest.fn(() => Promise.resolve("/mock/localdata"));
export const homeDir = jest.fn(() => Promise.resolve("/mock/home"));
export const join = jest.fn((...args: string[]) => Promise.resolve(args.join("/")));
