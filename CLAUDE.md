# TL-3D

3D viewer for TopLogic applications, based on three.js.

## Modules

| Module | Content |
|---|---|
| `tl-3d-core` | 3D math (transformations), TL-Script functions, model `tl.threed.core` |
| `tl-3d-threejs` | three.js integration: `ThreeJsComponent`, template `tl-3d-threejs/threejs.template.xml`, scene graph protocol (msgbuf, package `com.top_logic.threed.threejs.scene`) |
| `tl-3d-demo` | demo application: models `tl.threed.demo` (scenes, nodes, assets) and `tl.threed.demo.ui`, layouts under `WEB-INF/layouts/tl-3d-demo/` |

The TopLogic version is the parent version in all four `pom.xml` files; change them together.
Java 21.

## Build and test

```
mvn -B clean install                                     # tests skipped by default
mvn -B install -DskipTests=false -pl tl-3d-core,tl-3d-threejs
```

- Model wrappers (`tl-3d-core`, `tl-3d-demo`) are generated: after a model change or a TopLogic
  upgrade run `mvn tl:generate-java@generate-binding` in the module and commit the result
  separately.
- The msgbuf generator prints `No definition found for type ... java.lang.Object` /
  `... QueryExecutor`. This is known and does not break the build.
- The demo test `TestFileNames` fails if the untracked asset `assets/FTF-Module/Stütze` exists
  locally (`assets/*` is git-ignored). Not a code problem.
- Sources and resource bundles are UTF-8. Files `style/_*.css` are generated and git-ignored.

## Running the demo

- Start/stop with the skill `tl-claude-tools:tl-app` on `tl-3d-demo`. Login `root`; the
  password is set per database, ask the user.
- The demo database is H2 in `tl-3d-demo/tmp/` (git-ignored). Never delete it: the user keeps
  one database migrated through all TopLogic versions. The local H2 password comes from
  `devel-secrets.xml` (listed in `deploy/local/webapp/WEB-INF/conf/metaConf.txt`).
- Before copying the database, check that no application JVM is still running
  (`pgrep -af java`): the stop script reports "Stopped." as soon as the web server is down, even
  if the JVM still holds the database. A JVM killed while writing can leave a damaged page in the
  H2 file that a newer H2 version trips over later; rebuild such a file by `SCRIPT` (old H2
  version) and `RUNSCRIPT` (new version).
- The stop script deletes `tmp/tl-app.log`; the application log stays in
  `tmp/app-data/logs/top-logic.main*.log`.

## Database migrations

- Own migrations live in `tl-3d-demo/src/main/webapp/WEB-INF/kbase/migration/tl-3d-demo/`
  (migration module `tl-3d-demo`). Name them after the issue, e.g.
  `Issue_28_remove_tl_bpe_app.migration.xml`, and depend on the latest version of every engine
  migration module (see `databaseVersion.*` in table `TL_PROPERTIES`).
- Removing a dependency whose tables or model modules are stored in the database needs such a
  migration (tables: `DeleteTableProcessor`, model modules: `<delete-module>`), placed in
  `<pre-processors>` so that later processors can read the schema baseline.
- Never change a migration that has already been applied to a database.

## Access rights

- Roles `SecurityStructure.user` (group `user`, default group of new accounts) and
  `SecurityStructure.superuser` (group `superuser`), provided by `tl-element`.
- Role profiles: `tl-3d-demo/src/main/webapp/WEB-INF/conf/security.xml`. It is imported at
  startup whenever its content changes (`AccessConfigurationSetup`); an unknown view is logged as
  error and skipped. Users must not see the administration.
- Model-based access rights: `WEB-INF/conf/tl.threed.demo.security.config.xml`. Inheritance rules
  copy the roles of the security root to every scene part, asset collection, asset and connection
  point (workaround, see `docs/known-issues.md`); the UI module `tl.threed.demo.ui` is `internal`.
- Test account with role `user` only: `tl3dtest` (ask the user for the password).

## Known framework issues

`docs/known-issues.md` lists TopLogic problems with their Trac ticket and the workaround in
TL-3D. On every upgrade to a new TopLogic version, check for each entry whether the ticket is fixed
in that version; if so, remove the workaround and the entry.

## Git

- Main development branch: `master`.
- New features are developed on a branch `CWS/CWS_<nr>_<description>`, `<nr>` being the Gitea
  issue number.
- Commit messages: `Issue #<nr>: <sentence>.`
