/**
 * Character Library: storage, catalog and immutable references of erkasa.character/1 packages.
 * Read by the planning layer (catalog) and, from Phase 5, by the stager (resolve). Never by an Engine.
 */
export { CATALOG_SCHEMA, Catalog, CatalogEntry, immutableRef, parseImmutableRef } from "./catalog.js";
export { LIBRARY_ROOT, entryOf, packageDirs, publish, readCatalog, resolveRef, verifyPackage, type Verified } from "./store.js";
