/*
 * SPDX-FileCopyrightText: 2025 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.demo.scripting.actions;

import static com.top_logic.threed.core.math.Transformation.*;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import com.google.common.base.Functions;

import com.top_logic.basic.FileManager;
import com.top_logic.basic.Logger;
import com.top_logic.basic.col.MutableInteger;
import com.top_logic.basic.config.InstantiationContext;
import com.top_logic.basic.config.annotation.Label;
import com.top_logic.element.meta.MetaElementUtil;
import com.top_logic.knowledge.service.PersistencyLayer;
import com.top_logic.knowledge.service.Transaction;
import com.top_logic.layout.scripting.action.ApplicationAction;
import com.top_logic.layout.scripting.runtime.ActionContext;
import com.top_logic.layout.scripting.runtime.action.AbstractApplicationActionOp;
import com.top_logic.threed.core.math.Transformation;
import com.top_logic.threed.demo.model.Assembly;
import com.top_logic.threed.demo.model.Asset3D;
import com.top_logic.threed.demo.model.ConnectionPoint;
import com.top_logic.threed.demo.model.Part;
import com.top_logic.threed.demo.model.Scene;
import com.top_logic.threed.demo.model.TlThreedDemoFactory;
import com.top_logic.threed.demo.scripting.actions.CreateComplexSceneAction.Config;
import com.top_logic.threed.threejs.scene.SceneGraph;

/**
 * Test action that creates a complex {@link Scene}.
 * 
 * @author <a href="mailto:daniel.busche@top-logic.com">Daniel Busche</a>
 */
@Label("Create complex scene")
public class CreateComplexSceneAction extends AbstractApplicationActionOp<Config> {

	/**
	 * Configuration for a {@link CreateComplexSceneAction}.
	 * 
	 * @author <a href="mailto:daniel.busche@top-logic.com">Daniel Busche</a>
	 */
	public interface Config extends ApplicationAction {

		/**
		 * Number of stations to create in a floor.
		 */
		int getNumberStations();

		/**
		 * Number of floors to create.
		 */
		int getNumberFloors();

		/**
		 * Name of the {@link Scene}. If not set a name is created.
		 */
		String getSceneName();

		/**
		 * Whether assets are copied to simulate many different assets.
		 */
		int getNumberAssetClones();

	}
	private static final String ROBOTER_PODEST_1000MM =
		"F1/Roboter_Podest_1000mm/Roboter_Podest_1000mm.glb";

	private static final String ROBOTER_PODEST_500MM =
		"F1/Roboter_Podest_500mm/Roboter_Podest_500mm.glb";

	private static final String KR360 =
		"F1/KR360_R2830-4_Fortec/RB_ly000005_019_arw_2014-11-26_12_39_12.294_Default.glb";

	private static final String GEOGREIFER_GROSS =
		"F1/Geogreifer_gross/Geogreifer_gross.glb";

	private static final String ROBOTER_ACHSE =
		"F1/Roboter_7_Achse_12000/Roboter_7_Achse_12000.glb";

	private static final String LASER_QUELLE =
		"E4/Laserquelle_TruDisk4002/Laserquelle_TruDisk4002.glb";

	private static final String UEBERGANG =
		"E4/Uebergang_inkl_Treppe/Uebergang_inkl_Treppe.glb";

	private static final String SCHLEPPER_GROSS =
		"T3/Schlepper_gross/Schlepper_gross.glb";

	private static final String ASSETS_FOLDER = "/assets/";

	private Asset3D _greiferGrossTmpl, _kr360Tmpl, _podest500Tmpl, _podest1000Tmpl, _laserQuelleTmpl, _uebergangTmpl,
			_roboterAchseTmpl, _schlepperGrossTmpl;

	private List<Asset3D> _greiferGross = new ArrayList<>(),
			_kr360 = new ArrayList<>(),
			_podest500 = new ArrayList<>(),
			_podest1000 = new ArrayList<>(),
			_laserQuelle = new ArrayList<>(),
			_uebergang = new ArrayList<>(),
			_roboterAchse = new ArrayList<>(),
			_schlepperGross = new ArrayList<>();

	private Transaction _tx;

	/**
	 * Creates a {@link CreateComplexSceneAction}.
	 *
	 */
	public CreateComplexSceneAction(InstantiationContext context, Config config) {
		super(context, config);
	}

	@Override
	protected Object processInternal(ActionContext context, Object argument) throws Throwable {
		_tx = PersistencyLayer.getKnowledgeBase().beginTransaction();
		TlThreedDemoFactory factory = TlThreedDemoFactory.getInstance();
		createAssets(factory);
		createScene(factory);
		_tx.commit();

		return argument;
	}

	private void intermediateCommit() {
		_tx.commit();
		_tx = PersistencyLayer.getKnowledgeBase().beginTransaction();
	}

	private void createAssets(TlThreedDemoFactory factory) {
		List<Asset3D> allAssets =
			MetaElementUtil.getAllInstancesOf(TlThreedDemoFactory.getAsset3DType(), Asset3D.class);
		Map<String, Asset3D> assetsByJTFile =
			allAssets.stream().collect(Collectors.toMap(Asset3D::getJtFile, Functions.identity(), (a1, a2) -> a1));

		_greiferGrossTmpl = getOrCreate(factory, assetsByJTFile, GEOGREIFER_GROSS);
		_laserQuelleTmpl = getOrCreate(factory, assetsByJTFile, LASER_QUELLE);
		_uebergangTmpl = getOrCreate(factory, assetsByJTFile, UEBERGANG);
		_roboterAchseTmpl = getOrCreate(factory, assetsByJTFile, ROBOTER_ACHSE);
		_schlepperGrossTmpl = getOrCreate(factory, assetsByJTFile, SCHLEPPER_GROSS);

		_kr360Tmpl = getOrCreate(factory, assetsByJTFile, KR360);
		_kr360Tmpl.getSnappingPointsModifiable()
			.add(newConnectionPoint(factory,
				translate(1826, 0, 2300)
					.after(rotateZ(Math.PI / 2))
					.after(rotateX(Math.PI / 2))));

		_podest500Tmpl = getOrCreate(factory, assetsByJTFile, ROBOTER_PODEST_500MM);
		_podest500Tmpl.getSnappingPointsModifiable()
			.add(newConnectionPoint(factory, translate(0, 0, 500)));

		_podest1000Tmpl = getOrCreate(factory, assetsByJTFile, ROBOTER_PODEST_1000MM);
		_podest1000Tmpl.getSnappingPointsModifiable()
			.add(newConnectionPoint(factory, translate(0, 0, 1000)));

		cloneAssets(factory, assetsByJTFile);
	}

	private void cloneAssets(TlThreedDemoFactory factory, Map<String, Asset3D> assetsByJTFile) {
		cloneAsset(factory, assetsByJTFile, _greiferGross, _greiferGrossTmpl);
		cloneAsset(factory, assetsByJTFile, _laserQuelle, _laserQuelleTmpl);
		cloneAsset(factory, assetsByJTFile, _uebergang, _uebergangTmpl);
		cloneAsset(factory, assetsByJTFile, _roboterAchse, _roboterAchseTmpl);
		cloneAsset(factory, assetsByJTFile, _schlepperGross, _schlepperGrossTmpl);
		cloneAsset(factory, assetsByJTFile, _kr360, _kr360Tmpl);
		cloneAsset(factory, assetsByJTFile, _podest500, _podest500Tmpl);
		cloneAsset(factory, assetsByJTFile, _podest1000, _podest1000Tmpl);
	}

	private void cloneAsset(TlThreedDemoFactory factory, Map<String, Asset3D> assetsByJTFile, List<Asset3D> assets,
			Asset3D template) {
		assets.add(template);
		for (int i = 0; i < getConfig().getNumberAssetClones(); i++) {
			String jtFile = template.getJtFile();
			String newName = jtFile.substring(0, jtFile.length() - ".glb".length()) + "." + i + ".glb";
			Asset3D assetClone = getOrCreate(factory, assetsByJTFile, newName);
			template.getSnappingPoints()
				.stream()
				.map(cp -> copySnappingPoint(factory, cp))
				.forEach(assetClone.getSnappingPointsModifiable()::add);
			assets.add(assetClone);
			
			File imageFile = FileManager.getInstance().getIDEFile(ASSETS_FOLDER + newName);
			if (!imageFile.exists()) {
				File origFile = FileManager.getInstance().getIDEFile(ASSETS_FOLDER + jtFile);
				if (origFile.exists()) {
					try {
						Files.copy(origFile.toPath(), imageFile.toPath());
					} catch (IOException ex) {
						Logger.error(
							"Unable to copy " + origFile.getPath() + " to " + imageFile.getPath(), ex,
							CreateComplexSceneAction.class);
					}
				}

			}
		}
	}

	private Asset3D getOrCreate(TlThreedDemoFactory factory, Map<String, Asset3D> assetsByJTFile, String jt) {
		Asset3D asset3D = assetsByJTFile.get(jt);
		if (asset3D == null) {
			asset3D = factory.createAsset3D();
			asset3D.setJtFile(jt);
		} else {
			asset3D.getSnappingPointsModifiable().clear();
		}
		return asset3D;
	}

	private ConnectionPoint newConnectionPoint(TlThreedDemoFactory factory, Transformation tx, String... classifiers) {
		ConnectionPoint point = factory.createConnectionPoint();
		point.setTx(tx);
		point.setClassifiers(Set.of(classifiers));
		return point;
	}

	private ConnectionPoint copySnappingPoint(TlThreedDemoFactory factory, ConnectionPoint p) {
		return newConnectionPoint(factory, p.getTx(), p.getClassifiers().toArray(String[]::new));
	}

	private void createScene(TlThreedDemoFactory factory) {
		Scene scene = factory.createScene();
		scene.setName(sceneName());
		int numberOfFloors = getConfig().getNumberFloors();
		scene.tSetData(SceneGraph.NUMBER_OF_FLOORS__PROP, numberOfFloors);
		Assembly rootNode = factory.createAssembly();
		rootNode.setName("Building 1");
		scene.setRootNode(rootNode);

		intermediateCommit();

		MutableInteger assetNr = new MutableInteger();
		for (int i = 0; i < getConfig().getNumberFloors(); i++) {
			Assembly floor = addFloor(factory, rootNode, "Floor " + i, assetNr);
			floor.setTx(translate(0, 0, i * 15000));

			intermediateCommit();
		}


	}

	private Assembly addFloor(TlThreedDemoFactory factory, Assembly parent, String name, MutableInteger assetNr) {
		Assembly floor = factory.createAssembly();
		floor.setName(name);
		parent.addChild(floor);

		int numberStations = config.getNumberStations();
		int columns = (int) Math.sqrt(numberStations);
		int cnt = 0;
		int row = 0, column = 0;
		while (cnt < numberStations) {
			Assembly station = addStation(factory, floor, "Station " + cnt, assetNr.inc());
			station.setTx(translate(column * 20000, row * 10000, 0));

			if (column == columns) {
				row++;
				column = 0;
			} else {
				column++;
			}
			cnt++;
			if (cnt % 1000 == 0) {
				intermediateCommit();
			}
		}

		return floor;
	}

	private Assembly addStation(TlThreedDemoFactory factory, Assembly parent, String name, int assetNr) {
		assetNr = assetNr % (getConfig().getNumberAssetClones() + 1);
		Assembly station = factory.createAssembly();
		station.setName(name);
		parent.addChild(station);

		addPart(factory, station, "Achse", _roboterAchse.get(assetNr));

		Assembly robotSystem1 = addRobotSystem(factory, station, 1, assetNr);
		robotSystem1.setTx(translate(2000, 3500, 0).after(rotateZ(-Math.PI / 2)));
		Assembly robotSystem2 = addRobotSystem(factory, station, 2, assetNr);
		robotSystem2.setTx(translate(8000, 3500, 0).after(rotateZ(-Math.PI / 2)));
		Assembly robotSystem3 = addRobotSystem(factory, station, 3, assetNr);
		robotSystem3.setTx(translate(11000, 3500, 0).after(rotateZ(-Math.PI / 2)));
		Assembly robotSystem4 = addRobotSystem(factory, station, 4, assetNr);
		robotSystem4.setTx(translate(2000, -3500, 0).after(rotateZ(Math.PI / 2)));
		Assembly robotSystem5 = addRobotSystem(factory, station, 5, assetNr);
		robotSystem5.setTx(translate(8000, -3500, 0).after(rotateZ(Math.PI / 2)));
		Assembly robotSystem6 = addRobotSystem(factory, station, 6, assetNr);
		robotSystem6.setTx(translate(11000, -3500, 0).after(rotateZ(Math.PI / 2)));

		Part uebergang = addPart(factory, station, "Übergang", _uebergang.get(assetNr));
		uebergang.setTx(translate(4000, 0, 0).after(rotateZ(Math.PI / 2)));

		Part laserQuelle = addPart(factory, station, "Laser-Quelle", _laserQuelle.get(assetNr));
		laserQuelle.setTx(translate(0, -5000, 0).after(rotateZ(Math.PI / 4)));

		Part schlepper = addPart(factory, station, "Schlepper", _schlepperGross.get(assetNr));
		schlepper.setTx(translate(-1500, 2000, 0).after(rotateZ(Math.PI)));

		return station;
	}

	private Assembly addRobotSystem(TlThreedDemoFactory factory, Assembly parent, int number, int assetNr) {
		Assembly robotSystem = factory.createAssembly();
		robotSystem.setName("RS " + number);
		parent.addChild(robotSystem);

		Part robot = addPart(factory, robotSystem, "KR360", _kr360.get(assetNr));

		Part greifer = addPart(factory, robotSystem, "Greifer", _greiferGross.get(assetNr));

		Part podest = factory.createPart();
		robotSystem.addChild(podest);
		if (number % 3 == 0) {
			podest.setAsset(_podest1000.get(assetNr));
			robot.setTx(translate(0, 0, 1000));
			greifer.setTx(
				translate(0, 0, 1000)
					.after(translate(1826, 0, 2300))
					.after(rotateZ(Math.PI / 2))
					.after(rotateX(Math.PI / 2)));
		} else {
			podest.setAsset(_podest500.get(assetNr));
			robot.setTx(translate(0, 0, 500));
			greifer.setTx(
				translate(0, 0, 500)
					.after(translate(1826, 0, 2300))
					.after(rotateZ(Math.PI / 2))
					.after(rotateX(Math.PI / 2)));
		}
		podest.setName("Podest");
		return robotSystem;
	}

	private Part addPart(TlThreedDemoFactory factory, Assembly parent, String name, Asset3D asset) {
		Part robot = factory.createPart();
		parent.addChild(robot);
		robot.setAsset(asset);
		robot.setName(name);
		return robot;
	}

	private String sceneName() {
		String sceneName = config.getSceneName();
		if (!sceneName.isBlank()) {
			return sceneName;
		}
		return "Generated scene (" + new SimpleDateFormat("yyyyMMdd'T'HHmmss").format(new Date()) + ")";
	}

}
