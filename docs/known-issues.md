# Known TopLogic issues

TopLogic problems that TL-3D works around. On every upgrade to a new TopLogic version, check for
each entry whether the ticket is fixed in that version (Trac ticket and its milestone, or the
release notes of the version). If it is fixed, remove the workaround as described and delete the
entry.

## #30079: Security parents are ignored for structured elements

**Problem:** `StructuredElementWrapper#getSecurityParents()` returns an empty list. For types
implemented by it, configured security parents (`<security-parents>` of the `AccessManager`) and
the fallback to the security root are ignored. All types of the model `tl.threed.demo` are
implemented this way (`AttributedStructuredElementWrapper`).

**Workaround:** Four inheritance rules in
`tl-3d-demo/src/main/webapp/WEB-INF/conf/tl.threed.demo.security.config.xml` copy the roles of the
security root (`SecurityStructure#ROOT`) to every `ScenePart`, `AssetCollection`, `Asset3D` and
`ConnectionPoint`. This stores about two role entries per object (≈ 63,000 for the demo data); the
role computation takes about 3 minutes when the rules change.

**Fixed in:** Engine `master` (commit `5b6c8d9d21`), not in 8.0.0-alpha12.

**Remove the workaround:** Replace the four inheritance rules by security parent rules that name the
security root:

```xml
<security-parents>
	<rule id="SecRootForScenePart" inherit="true" meta-element="tl.threed.demo:ScenePart">
		<singleton module="SecurityStructure"/>
	</rule>
	<!-- same for AssetCollection, Asset3D, ConnectionPoint -->
</security-parents>
```

Then start the application and check as a user with role `SecurityStructure.user` only that scenes
and assets are visible and editable.

## #30184: `DeleteTableProcessor` cannot remove abstract tables

**Problem:** The migration processor `DeleteTableProcessor` (`<delete-table>`) executes
`DROP TABLE` for every listed table, also for abstract tables that have no database table. The
statement fails, and the abstract table stays in the stored schema; at the next start the engine
recovers it into `WEB-INF/autoconf/inapp-schema-*.meta.xml`. It also does not remove
`<alternative>` entries that reference deleted tables.

**Workaround:** The migration
`tl-3d-demo/src/main/webapp/WEB-INF/kbase/migration/tl-3d-demo/Issue_28_remove_tl_bpe_app.migration.xml`
removes the abstract table `BPItem` with an `XsltTableDefinitionBaselineProcessor` and
`Issue_28_remove_tl_bpe_app.schema.xslt`.

**Fixed in:** Engine `master` (commit `e5eba84aae`), not in 8.0.0-alpha12.

**Remove the workaround:** Nothing to change: that migration has already been applied to existing
databases and must stay as it is. Once the fix is available, new migrations can list abstract
tables directly in `DeleteTableProcessor`; then delete this entry.
