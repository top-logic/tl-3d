/*
 * SPDX-FileCopyrightText: 2025 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.demo.scripting.actions;

import static com.top_logic.threed.core.math.Transformation.*;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import com.google.common.base.Functions;

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

	}
	private static final String ROBOTER_PODEST_1000MM =
		"F1/Roboter_Podest_1000mm/Roboter_Podest_1000mm.jt";

	private static final String ROBOTER_PODEST_500MM =
		"F1/Roboter_Podest_500mm/Roboter_Podest_500mm.jt";

	private static final String KR360 =
		"F1/KR360_R2830-4_Fortec/RB_ly000005_019_arw_2014-11-26_12_39_12.294_Default.jt";

	private static final String GEOGREIFER_GROSS =
		"F1/Geogreifer_gross/Geogreifer_gross.jt";

	private static final String LASER_QUELLE =
		"E4/Laserquelle_TruDisk4002/Laserquelle_TruDisk4002.jt";

	private static final String UEBERGANG =
		"E4/Uebergang_inkl_Treppe/Uebergang_inkl_Treppe.jt";

	private static final String ROBOTER_ACHSE =
		"F1/Roboter_7_Achse_12000/Roboter_7_Achse_12000.jt";

	private static final String SCHLEPPER_GROSS =
		"T3/Schlepper_gross/Schlepper_gross.jt";

	private Asset3D _greiferGross, _kr360, _podest500, _podest1000, _laserQuelle, _uebergang, _roboterAchse,
			_schlepperGross;

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

		_greiferGross = getOrCreate(factory, assetsByJTFile, GEOGREIFER_GROSS);
		_laserQuelle = getOrCreate(factory, assetsByJTFile, LASER_QUELLE);
		_uebergang = getOrCreate(factory, assetsByJTFile, UEBERGANG);
		_roboterAchse = getOrCreate(factory, assetsByJTFile, ROBOTER_ACHSE);
		_schlepperGross = getOrCreate(factory, assetsByJTFile, SCHLEPPER_GROSS);

		_kr360 = getOrCreate(factory, assetsByJTFile, KR360);
		_kr360.getSnappingPointsModifiable()
			.add(newConnectionPoint(factory,
				translate(1826, 0, 2300)
					.after(rotateZ(Math.PI / 2))
					.after(rotateX(Math.PI / 2))));

		_podest500 = getOrCreate(factory, assetsByJTFile, ROBOTER_PODEST_500MM);
		_podest500.getSnappingPointsModifiable()
			.add(newConnectionPoint(factory, translate(0, 0, 500)));

		_podest1000 = getOrCreate(factory, assetsByJTFile, ROBOTER_PODEST_1000MM);
		_podest1000.getSnappingPointsModifiable()
			.add(newConnectionPoint(factory, translate(0, 0, 1000)));

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

	private void createScene(TlThreedDemoFactory factory) {
		Scene scene = factory.createScene();
		scene.setName(sceneName());
		int numberOfFloors = getConfig().getNumberFloors();
		scene.tSetData(SceneGraph.NUMBER_OF_FLOORS__PROP, numberOfFloors);
		Assembly rootNode = factory.createAssembly();
		rootNode.setName("Building 1");
		scene.setRootNode(rootNode);

		intermediateCommit();

		for (int i = 0; i < getConfig().getNumberFloors(); i++) {
			Assembly floor = addFloor(factory, rootNode, "Floor " + i);
			floor.setTx(translate(0, 0, i * 15000));

			intermediateCommit();
		}


	}

	private Assembly addFloor(TlThreedDemoFactory factory, Assembly parent, String name) {
		Assembly floor = factory.createAssembly();
		floor.setName(name);
		parent.addChild(floor);

		int numberStations = config.getNumberStations();
		int columns = (int) Math.sqrt(numberStations);
		int cnt = 0;
		int row = 0, column = 0;
		while (cnt < numberStations) {
			Assembly station = addStation(factory, floor, "Station " + cnt);
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

	private Assembly addStation(TlThreedDemoFactory factory, Assembly parent, String name) {
		Assembly station = factory.createAssembly();
		station.setName(name);
		parent.addChild(station);

		addPart(factory, station, "Achse", _roboterAchse);

		Assembly robotSystem1 = addRobotSystem(factory, station, 1);
		robotSystem1.setTx(translate(2000, 3500, 0).after(rotateZ(-Math.PI / 2)));
		Assembly robotSystem2 = addRobotSystem(factory, station, 2);
		robotSystem2.setTx(translate(8000, 3500, 0).after(rotateZ(-Math.PI / 2)));
		Assembly robotSystem3 = addRobotSystem(factory, station, 3);
		robotSystem3.setTx(translate(11000, 3500, 0).after(rotateZ(-Math.PI / 2)));
		Assembly robotSystem4 = addRobotSystem(factory, station, 4);
		robotSystem4.setTx(translate(2000, -3500, 0).after(rotateZ(Math.PI / 2)));
		Assembly robotSystem5 = addRobotSystem(factory, station, 5);
		robotSystem5.setTx(translate(8000, -3500, 0).after(rotateZ(Math.PI / 2)));
		Assembly robotSystem6 = addRobotSystem(factory, station, 6);
		robotSystem6.setTx(translate(11000, -3500, 0).after(rotateZ(Math.PI / 2)));

		Part uebergang = addPart(factory, station, "Übergang", _uebergang);
		uebergang.setTx(translate(4000, 0, 0).after(rotateZ(Math.PI / 2)));

		Part laserQuelle = addPart(factory, station, "Laser-Quelle", _laserQuelle);
		laserQuelle.setTx(translate(0, -5000, 0).after(rotateZ(Math.PI / 4)));

		Part schlepper = addPart(factory, station, "Schlepper", _schlepperGross);
		schlepper.setTx(translate(-1500, 2000, 0).after(rotateZ(Math.PI)));

		return station;
	}

	private Assembly addRobotSystem(TlThreedDemoFactory factory, Assembly parent, int number) {
		Assembly robotSystem = factory.createAssembly();
		robotSystem.setName("RS " + number);
		parent.addChild(robotSystem);

		Part robot = addPart(factory, robotSystem, "KR360", _kr360);

		Part greifer = addPart(factory, robotSystem, "Greifer", _greiferGross);

		Part podest = factory.createPart();
		robotSystem.addChild(podest);
		if (number % 3 == 0) {
			podest.setAsset(_podest1000);
			robot.setTx(translate(0, 0, 1000));
			greifer.setTx(
				translate(0, 0, 1000)
					.after(translate(1826, 0, 2300))
					.after(rotateZ(Math.PI / 2))
					.after(rotateX(Math.PI / 2)));
		} else {
			podest.setAsset(_podest500);
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
