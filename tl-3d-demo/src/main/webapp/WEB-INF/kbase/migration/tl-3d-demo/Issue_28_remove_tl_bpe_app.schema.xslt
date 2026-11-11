<?xml version="1.0" encoding="utf-8" ?>

<!--
	Removes the abstract table BPItem of the process engine from the stored schema. It has no
	database table, therefore DeleteTableProcessor (which drops the table) cannot be used for it.
-->
<xsl:stylesheet
	xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
	version="1.0"
>
	<xsl:template match="/config/meta-objects/metaobject[@object_name='BPItem']">
		<!-- remove -->
	</xsl:template>

	<!-- standard copy template -->
	<xsl:template match="@*|node()">
		<xsl:copy>
			<xsl:apply-templates select="@*"/>
			<xsl:apply-templates/>
		</xsl:copy>
	</xsl:template>
</xsl:stylesheet>
