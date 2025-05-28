/*
 * SPDX-FileCopyrightText: 2025 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.threejs.control;

import java.io.IOException;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.text.Format;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;

import com.top_logic.basic.CollectionUtil;
import com.top_logic.basic.util.ResKey;
import com.top_logic.basic.util.Utils;
import com.top_logic.basic.xml.TagWriter;
import com.top_logic.layout.AbstractResourceProvider;
import com.top_logic.layout.DisplayContext;
import com.top_logic.layout.ResourceProvider;
import com.top_logic.layout.basic.AbstractCommandModel;
import com.top_logic.layout.basic.AbstractControl;
import com.top_logic.layout.basic.TemplateVariable;
import com.top_logic.layout.form.FormField;
import com.top_logic.layout.form.FormMember;
import com.top_logic.layout.form.ValueListener;
import com.top_logic.layout.form.control.ButtonControl;
import com.top_logic.layout.form.control.DropDownControl;
import com.top_logic.layout.form.control.TextInputControl;
import com.top_logic.layout.form.model.FormContext;
import com.top_logic.layout.form.model.FormFactory;
import com.top_logic.layout.form.model.SelectField;
import com.top_logic.layout.form.model.SelectFieldUtils;
import com.top_logic.threed.core.math.Transformation;
import com.top_logic.threed.threejs.component.CoordinateSystem;
import com.top_logic.threed.threejs.component.CoordinateSystemProvider;
import com.top_logic.tool.boundsec.HandlerResult;
import com.top_logic.util.Resources;
import com.top_logic.util.TLContext;

/**
 * Control displaying input fields to modify the displayed gizmo.
 * 
 * @author <a href="mailto:daniel.busche@top-logic.com">Daniel Busche</a>
 */
public class GizmoControl extends AbstractControl {

	private static final String COORDINATE_SYSTEMS = "coordinateSystems";

	private static final String TRANSLATE_X = "translate-x";

	private static final String TRANSLATE_Y = "translate-y";

	private static final String TRANSLATE_Z = "translate-z";

	private static final String ROTATE_X = "rotate-x";

	private static final String ROTATE_Y = "rotate-y";

	private static final String ROTATE_Z = "rotate-z";

	private FormContext _formContext;

	private Consumer<Transformation> _consumer = null;

	private Transformation _tx = Transformation.identity();

	private Transformation _coordinateSystem;

	private Format _translateFormat;

	private Format _rotateFormat;

	private boolean _minimized = false;

	private boolean _editable = false;

	private Consumer<CoordinateSystem> _selectionCallback = cs -> {
		//
	};

	private ResourceProvider _coordinateSystemLabels = new AbstractResourceProvider() {
		Resources _resources = resources();

		@Override
		public String getLabel(Object object) {
			return _resources.getString(((CoordinateSystem) object).getLabel());
		}

		@Override
		public String getTooltip(Object anObject) {
			return getLabel(anObject);
		}

	};
	/**
	 * Creates a {@link GizmoControl}.
	 */
	public GizmoControl() {
		setNumberTranslateFraction(0);
		setNumberRotateFraction(0);
		_formContext = createContext();
		updateDisabled();
	}

	@Override
	protected String getTypeCssClass() {
		return "cGizmo";
	}

	/**
	 * Sets the coordinate systems to the select.
	 */
	public GizmoControl setCoordinateSystems(List<CoordinateSystemProvider> coordinateSystems,
			Consumer<CoordinateSystem> selectionCallback) {
		_selectionCallback = Objects.requireNonNull(selectionCallback);
		List<CoordinateSystem> systems = Objects.requireNonNull(coordinateSystems)
			.stream()
			.map(CoordinateSystemProvider::getCoordinateSystem)
			.toList();
		SelectField field = (SelectField) field(COORDINATE_SYSTEMS);
		String currentSelection;
		CoordinateSystem value = (CoordinateSystem) field.getSingleSelection();
		if (value != null) {
			currentSelection = _coordinateSystemLabels.getLabel(value);
		} else {
			currentSelection = null;
		}
		SelectFieldUtils.setOptions(field, systems);
		if (currentSelection != null && field.getSingleSelection() == null) {
			systems.stream()
				.filter(system -> currentSelection.equals(_coordinateSystemLabels.getLabel(system)))
				.findFirst()
				.ifPresent(newSelection -> field.setAsSingleSelection(newSelection));
		}

		return this;
	}

	/**
	 * Marks the input fields as editable or disabled.
	 */
	public GizmoControl setEditable(boolean value) {
		_editable = value;
		updateDisabled();
		return this;
	}

	/**
	 * Consumer to call when the stored {@link Transformation} changes.
	 */
	public GizmoControl setConsumer(Consumer<Transformation> consumer) {
		_consumer = consumer;
		return this;
	}

	/**
	 * Number of fractions of the translation values of {@link #getModel()} to display.
	 */
	public GizmoControl setNumberTranslateFraction(int numberFractions) {
		String pattern;
		if (numberFractions <= 0) {
			pattern = "#";
		} else {
			pattern = "#." + "#".repeat(numberFractions);

		}
		return setTranslateFormat(new DecimalFormat(pattern, DecimalFormatSymbols.getInstance(TLContext.getLocale())));
	}

	/**
	 * Number of fractions of the rotation values of {@link #getModel()} to display.
	 */
	public GizmoControl setNumberRotateFraction(int numberFractions) {
		String pattern;
		if (numberFractions <= 0) {
			pattern = "#";
		} else {
			pattern = "#." + "#".repeat(numberFractions);

		}
		return setRotateFormat(new DecimalFormat(pattern, DecimalFormatSymbols.getInstance(TLContext.getLocale())));
	}

	/**
	 * Format to display the translation values of {@link #getModel()}.
	 */
	public GizmoControl setTranslateFormat(Format format) {
		_translateFormat = format;
		return this;
	}

	/**
	 * Format to display the rotation values of {@link #getModel()}.
	 */
	public GizmoControl setRotateFormat(Format format) {
		_rotateFormat = format;
		return this;
	}

	private FormContext createContext() {
		FormContext ctx = new FormContext("ctx", I18NConstants.GIZMO_FORM_CTX);
		ctx.addMember(newTranslateField(TRANSLATE_X, I18NConstants.TRANSLATE_X_LABEL));
		ctx.addMember(newTranslateField(TRANSLATE_Y, I18NConstants.TRANSLATE_Y_LABEL));
		ctx.addMember(newTranslateField(TRANSLATE_Z, I18NConstants.TRANSLATE_Z_LABEL));
		ctx.addMember(newRotateField(ROTATE_X, I18NConstants.ROTATE_X_LABEL));
		ctx.addMember(newRotateField(ROTATE_Y, I18NConstants.ROTATE_Y_LABEL));
		ctx.addMember(newRotateField(ROTATE_Z, I18NConstants.ROTATE_Z_LABEL));
		ctx.addMember(newCoordinateSystemsField());
		return ctx;
	}

	private FormMember newCoordinateSystemsField() {
		SelectField coordinatesField = FormFactory.newSelectField(COORDINATE_SYSTEMS, Collections.emptyList());
		coordinatesField.setLabel(resources().getString(I18NConstants.COORDINATE_SYSTEMS_LABEL));
		coordinatesField.setEmptyLabel(resources().getString(I18NConstants.WORD_COORDINATES));

		coordinatesField.setOptionLabelProvider(_coordinateSystemLabels);
		coordinatesField.addValueListener(new ValueListener() {

			@Override
			public void valueChanged(FormField field, Object oldValue, Object newValue) {
				CoordinateSystem selectedCoordinates = (CoordinateSystem) CollectionUtil.getSingleValueFrom(newValue);
				_selectionCallback.accept(selectedCoordinates);
				handleCoordinateSystemChanged(selectedCoordinates);
			}

		});
		// Coordinate system should be always selectable.
		coordinatesField.setInheritDeactivation(false);
		return coordinatesField;
	}

	void handleCoordinateSystemChanged(CoordinateSystem coordinates) {
		Transformation tx;
		if (coordinates == null) {
			tx = null;
		} else {
			tx = coordinates.getTx();
		}
		_coordinateSystem = tx;
		Transformation model = getModel();
		if (model != null) {
			initFieldsAfterCoordinateSystemChanged(model);
		}
	}

	void updateDisabled() {
		_formContext.setDisabled(getModel() == null || !_editable);
	}

	/**
	 * Sets the model for this {@link GizmoControl}
	 */
	public void setModel(Transformation tx) {
		if (Utils.equals(tx, getModel())) {
			return;
		}
		internalSetModel(tx);
		if (tx == null) {
			field(TRANSLATE_X).initializeField(null);
			field(TRANSLATE_Y).initializeField(null);
			field(TRANSLATE_Z).initializeField(null);
			field(ROTATE_X).initializeField(null);
			field(ROTATE_Y).initializeField(null);
			field(ROTATE_Z).initializeField(null);
		} else {
			initFieldsAfterCoordinateSystemChanged(tx);
		}
	}

	private void initFieldsAfterCoordinateSystemChanged(Transformation model) {
		Transformation finalTransform;
		if (_coordinateSystem == null) {
			finalTransform = model;
		} else {
			finalTransform = _coordinateSystem.inverse().after(model);
		}
		field(TRANSLATE_X).initializeField(finalTransform.x());
		field(TRANSLATE_Y).initializeField(finalTransform.y());
		field(TRANSLATE_Z).initializeField(finalTransform.z());
		field(ROTATE_X).initializeField(toDegrees(finalTransform.getRotationX()));
		field(ROTATE_Y).initializeField(toDegrees(finalTransform.getRotationY()));
		field(ROTATE_Z).initializeField(toDegrees(finalTransform.getRotationZ()));
	}

	private void internalSetModel(Transformation tx) {
		_tx = tx;
		updateDisabled();
	}

	private double translateValue(String name) {
		return ((Number) field(name).getValue()).doubleValue();
	}

	private double rotateValue(String name) {
		return fromDegrees(((Number) field(name).getValue()).doubleValue());
	}

	private double toDegrees(double angle) {
		return angle * 180 / Math.PI;
	}

	private double fromDegrees(double degree) {
		return degree * Math.PI / 180;
	}

	/**
	 * Listener that is called when a translate field changed.
	 *
	 * @param field
	 *        The changed field. Old value of the field.
	 * @param oldValue
	 *        Old value of the field.
	 * @param newValue
	 *        New value of the field.
	 * 
	 * @see ValueListener
	 */
	void handleTranslateValueChanged(FormField field, Object oldValue, Object newValue) {
		updateModel();
	}

	/**
	 * Listener that is called when a rotate field changed.
	 *
	 * @param field
	 *        The changed field. Old value of the field.
	 * @param oldValue
	 *        Old value of the field.
	 * @param newValue
	 *        New value of the field.
	 * 
	 * @see ValueListener
	 */
	void handleRotateValueChanged(FormField field, Object oldValue, Object newValue) {
		updateModel();
	}

	private void updateModel() {
		FormField translateX = field(TRANSLATE_X);
		if (!translateX.hasValue() || translateX.getValue() == null) {
			return;
		}
		FormField translateY = field(TRANSLATE_Y);
		if (!translateY.hasValue() || translateY.getValue() == null) {
			return;
		}
		FormField translateZ = field(TRANSLATE_Z);
		if (!translateZ.hasValue() || translateZ.getValue() == null) {
			return;
		}
		FormField rotateX = field(ROTATE_X);
		if (!rotateX.hasValue() || rotateX.getValue() == null) {
			return;
		}
		FormField rotateY = field(ROTATE_Y);
		if (!rotateY.hasValue() || rotateY.getValue() == null) {
			return;
		}
		FormField rotateZ = field(ROTATE_Z);
		if (!rotateZ.hasValue() || rotateZ.getValue() == null) {
			return;
		}
		Transformation txFromFields = Transformation
			.translate(translateValue(TRANSLATE_X), translateValue(TRANSLATE_Y), translateValue(TRANSLATE_Z))
			.after(Transformation.rotateZ(rotateValue(ROTATE_Z)))
			.after(Transformation.rotateY(rotateValue(ROTATE_Y)))
			.after(Transformation.rotateX(rotateValue(ROTATE_X)));
		Transformation newTX = txFromFields;
		if (_coordinateSystem == null) {
			newTX = txFromFields;
		} else {
			newTX = _coordinateSystem.after(txFromFields);
		}
		if (Utils.equals(newTX, getModel())) {
			return;
		}
		internalSetModel(newTX);
		if (_consumer != null) {
			_consumer.accept(getModel());
		}
	}

	private FormField newTranslateField(String name, ResKey label) {
		Format format = (Format) _translateFormat.clone();
		FormField field = FormFactory.newNumberField(name, format, null, false);
		field.addValueListener(this::handleTranslateValueChanged);
		field.setLabel(resources().getString(label));
		return field;
	}

	static Resources resources() {
		return Resources.getInstance();
	}

	private FormField newRotateField(String name, ResKey label) {
		FormField field = FormFactory.newNumberField(name, (Format) _rotateFormat.clone(), null, false);
		field.addValueListener(this::handleRotateValueChanged);
		field.setLabel(resources().getString(label));
		return field;
	}

	@Override
	public Transformation getModel() {
		return _tx;
	}

	@Override
	public boolean isVisible() {
		return true;
	}

	@Override
	protected void internalWrite(DisplayContext context, TagWriter out) throws IOException {
		Icons.EDIT_GIZMO.get().write(context, out, this);
	}

	/**
	 * Writes the field displaying the X translation.
	 */
	@TemplateVariable("translateX")
	public void writeTranslationX(DisplayContext context, TagWriter out) throws IOException {
		writeTranslation(context, out, TRANSLATE_X);
	}

	/**
	 * Label of the field displaying the X translation.
	 */
	@TemplateVariable("translateXLabel")
	public String getTranslateXLabel() {
		return field(TRANSLATE_X).getLabel();
	}

	/**
	 * Writes the field displaying the Y translation.
	 */
	@TemplateVariable("translateY")
	public void writeTranslationY(DisplayContext context, TagWriter out) throws IOException {
		writeTranslation(context, out, TRANSLATE_Y);
	}

	/**
	 * Label of the field displaying the Y translation.
	 */
	@TemplateVariable("translateYLabel")
	public String getTranslateYLabel() {
		return field(TRANSLATE_Y).getLabel();
	}

	/**
	 * Writes the field displaying the Z translation.
	 */
	@TemplateVariable("translateZ")
	public void writeTranslationZ(DisplayContext context, TagWriter out) throws IOException {
		writeTranslation(context, out, TRANSLATE_Z);
	}

	/**
	 * Label of the field displaying the Z translation.
	 */
	@TemplateVariable("translateZLabel")
	public String getTranslateZLabel() {
		return field(TRANSLATE_Z).getLabel();
	}

	/**
	 * Writes the field displaying the X rotation.
	 */
	@TemplateVariable("rotateX")
	public void writeRotateX(DisplayContext context, TagWriter out) throws IOException {
		writeRotate(context, out, ROTATE_X);
	}

	/**
	 * Label of the field displaying the X rotation.
	 */
	@TemplateVariable("rotateXLabel")
	public String getRotateXLabel() {
		return field(ROTATE_X).getLabel();
	}

	/**
	 * Writes the field displaying the Y rotation.
	 */
	@TemplateVariable("rotateY")
	public void writeRotateY(DisplayContext context, TagWriter out) throws IOException {
		writeRotate(context, out, ROTATE_Y);
	}

	/**
	 * Label of the field displaying the Y rotation.
	 */
	@TemplateVariable("rotateYLabel")
	public String getRotateYLabel() {
		return field(ROTATE_Y).getLabel();
	}

	/**
	 * Writes the field displaying the Z rotation.
	 */
	@TemplateVariable("rotateZ")
	public void writeRotateZ(DisplayContext context, TagWriter out) throws IOException {
		writeRotate(context, out, ROTATE_Z);
	}

	/**
	 * Label of the field displaying the Z rotation.
	 */
	@TemplateVariable("rotateZLabel")
	public String getRotateZLabel() {
		return field(ROTATE_Z).getLabel();
	}

	/**
	 * Writes the field for selecting coordinate system.
	 */
	@TemplateVariable("coordinateSystems")
	public void writeCoordinateSystems(DisplayContext context, TagWriter out) throws IOException {
		new DropDownControl(field(COORDINATE_SYSTEMS)).write(context, out);
	}

	/**
	 * Label of the field for selecting coordinate system.
	 */
	@TemplateVariable("coordinateSystemsLabel")
	public String getCoordinateSystemsLabel() {
		return field(COORDINATE_SYSTEMS).getLabel();
	}

	private void writeTranslation(DisplayContext context, TagWriter out, String name) throws IOException {
		new TextInputControl(field(name)).write(context, out);
	}

	private void writeRotate(DisplayContext context, TagWriter out, String name) throws IOException {
		new TextInputControl(field(name)).write(context, out);
	}

	private FormField field(String name) {
		return _formContext.getField(name);
	}

	/**
	 * The button that minimizes the view by collapsing the contents.
	 */
	@TemplateVariable("collapseButton")
	public ButtonControl getCollapseButton() {
		return new ButtonControl(new ToggleCollapse(this));
	}

	/**
	 * Whether this control is minimized.
	 */
	@TemplateVariable("minimized")
	public boolean isMinimized() {
		return _minimized;
	}

	void setMinimized(boolean minimized) {
		if (minimized == _minimized) {
			return;
		}
		_minimized = minimized;
		requestRepaint();
	}

	private static class ToggleCollapse extends AbstractCommandModel {

		private GizmoControl _gizmoControl;

		ToggleCollapse(GizmoControl gizmoControl) {
			_gizmoControl = gizmoControl;
			update();
		}

		private void update() {
			boolean minimized = _gizmoControl.isMinimized();

			setImage(minimized ? com.top_logic.layout.structure.Icons.WINDOW_NORMALIZE
				: com.top_logic.layout.structure.Icons.WINDOW_MINIMIZE);
			ResKey tooltipKey = minimized ? com.top_logic.layout.structure.I18NConstants.EXPAND_IMAGE_TEXT
				: com.top_logic.layout.structure.I18NConstants.COLLAPSE_IMAGE_TEXT;
			setTooltip(resources().getString(tooltipKey));
			setLabel(resources().getString(tooltipKey));
		}

		@Override
		protected HandlerResult internalExecuteCommand(DisplayContext context) {
			_gizmoControl.setMinimized(!_gizmoControl.isMinimized());
			return HandlerResult.DEFAULT_RESULT;
		}

	}

}
