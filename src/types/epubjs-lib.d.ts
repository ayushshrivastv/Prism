declare module "epubjs/lib/index.js" {
  export * from "epubjs";
  const ePubFactory: typeof import("epubjs")["default"];
  export default ePubFactory;
}
