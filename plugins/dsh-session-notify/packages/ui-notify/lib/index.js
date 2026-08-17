//#region src/index.ts
/**
* Node (Host/loader) half of the ui-notify plugin. The browser half ships via
* `exports["./client"]`; this entry exists so one cordis.yml row composes
* both faces, mirroring dsh-client-ui-jobs.
*/
const name = "ui-notify";
function apply() {}
//#endregion
export { apply, name };
