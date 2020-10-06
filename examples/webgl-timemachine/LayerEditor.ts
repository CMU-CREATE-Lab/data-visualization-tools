/// <reference types="../../js/jquery/jsrender"/>

import { gEarthTime } from "./EarthTime";

export class LayerEditor {
	_LayerMap = new Map<string, Array<string>>();

	_LayerInfoTemplate = $.templates(` 
	<p>
		Name: {{:name}}<br>
		Category: {{:category}}<br>
		Share Link Identifier: {{:id}}<br>
		{{if hasDateRange}}
			Start Date: {{:startDate}}<br>
			End Date: {{:endDate}}<br>
		{{/if}}
		{{if hasColor}}
			Color: {{:color}}<br>
		{{/if}}
		Draw Order: {{:drawOrder}}<br>
		{{if hasDrawOptions}}
			Draw Options:<br>
				{{:drawOptions}}
		{{/if}}
	</p>
	`);

	_LayerJSONTemplate = $.templates('<textarea class="json-textarea" data-id="{{:layerId}}" autocomplete="off">{{:layerDefJSON}}</textarea>')

	constructor(editorId: string) {
		
		var html = '<div id="layer-editor-container"><ol id="layer-editor-selectable">';

		for(let layerProxy of gEarthTime.layerDB.visibleLayers) {
			html += `<li data-id=${layerProxy.id} ui-widget-content">${layerProxy.name}</li>`;
		}

		html += '</ol></div>';

		$(`#${editorId}`).html(html);

		var that = this;

		$('#layer-editor-selectable').selectable({
			selected: function(e, ui) {
				that._loadLayer(ui.selected.getAttribute('data-id'), editorId)
			}
		});

		$('#layer-editor-selectable').selectable("option", "appendTo", `#${editorId}`);

	}

	_loadLayer(layerId: string, editorId: string) {

		if (!$('#layer-editor-tabs').length) {
			$(`#${editorId}`).append(`
				<div id="layer-editor-tabs">
					<ul>
						<li><a href="#layer-ui-editor">Layer Information</a></li>
						<li><a href="#layer-json-editor">Layer JSON</a></li>
					</ul>
					<div id="layer-ui-editor"></div>
					<div id="layer-json-editor">
						<button id="layer-json-button" type="button">Update</button>
					</div>
				</div>
			`);

			$('#layer-editor-tabs').tabs();
			$('#layer-editor-tabs').tabs("option", "appendTo", `#${editorId}`);
		}

		if (this._LayerMap.has(layerId)) {
			let layer = this._LayerMap.get(layerId)
			$('#layer-ui-editor').html(layer[0]);
			$('.json-textarea').replaceWith(layer[1]);
		}
		else {
			let layerInfo = this._gatherInfoFor(layerId);
			let layerHTML = this._LayerInfoTemplate(layerInfo[0]);
			let jsonHTML = this._LayerJSONTemplate(layerInfo[1]);
			this._LayerMap.set(layerId, [layerHTML, jsonHTML]);

			$('#layer-ui-editor').html(layerHTML);

			if ($('.json-textarea').length > 0)
				$('.json-textarea').replaceWith(jsonHTML);
			else
				$('#layer-json-editor').prepend(jsonHTML);
		}

		var that = this

		$('#layer-json-button').click(function() {
			var text = $('.json-textarea').val() as string;
			gEarthTime.layerDB.getLayer(layerId)._loadFromLayerdef(JSON.parse(text));
			let layerInfo = that._gatherInfoFor(layerId);
			let layerHTML = that._LayerInfoTemplate(layerInfo[0]);
			let jsonHTML = that._LayerJSONTemplate(layerInfo[1]);
			that._LayerMap.set(layerId, [layerHTML, jsonHTML])

			$('#layer-ui-editor').html(layerHTML)
			$('.json-textarea').replaceWith(jsonHTML);
		})
	}

	_gatherInfoFor(layerId: string) {
		var layer = gEarthTime.layerDB.getLayer(layerId).layer

		var layerInfo = {
			name: layer.name,
			category: layer.category,
			id: layer.layerId,
			hasDateRange: layer.startDate ? true : false,
			startDate: layer.startDate,
			endDate: layer.endDate,
			hasColor: layer.color ? true : false,
			color: layer.color,
			drawOrder: layer.drawOrder,
			hasDrawOptions: layer.drawOptions && Object.keys(layer.drawOptions).length > 0 ? true : false,
			drawOptions: layer.drawOptions ? JSON.stringify(this._stringifyOptions(layer.drawOptions), null, 8) : {}
		};

		return [layerInfo, {layerId: layerId, layerDefJSON: JSON.stringify(layer.layerDef, null, 4)}];
	}

	_stringifyOptions(drawOptions: object, spaces=0) {
		var options = '';

		for (var i=0; i < spaces; i++)
			options += ' ';

		var options = '{';

		for (var key in drawOptions) {
			for (var i = 0; i < (spaces + 4); i++)
				options += ' ';

			options += `${key}: `

			var value = drawOptions[key];

			if (typeof(value) == 'string' || typeof(value) == 'number')
				options += value;
			else if (value instanceof Array)
				options += '[' + value + ']';
			else
				options += this._stringifyOptions(value, spaces+4);

			options += ',';
		}

		options = options.substring(0, options.length - 1);
			
	    for (var i = 0; i < spaces; i++)
			options += ' ';

		options += '}';

		return options;
	}
}

