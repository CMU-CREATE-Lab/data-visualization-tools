/// <reference types="../../js/jquery/jsrender"/>

const BaseTemplate: string = `
<div>
{{props ~root itemVar="~parent"}}
  {{if ~isNotDict(~parent^prop)}}
	<b>{{>~parent^key}}:</b> {{>~parent^prop}}<br>
  {{else}}
	<b>{{>~parent^key}}:</b>
	<div style="padding-left:13px">
	  {{props ~parent^prop itemVar="~child"}}
		{{if ~isNotDict(~child^prop)}}
		  <b>{{>~child^key}}:</b> {{>~child^prop}}<br>
		{{else}}
		  <b>{{>~child^key}}:</b>
		  <div style="padding-left:13px">
			{{props ~child^prop itemVar="~gchild"}}
			  <b>{{~gchild^key}}:</b> {{>~gchild^prop}}<br>
			{{/props}}
		  </div>
		  <br>
		{{/if}}
	  {{/props}}
	</div>
	<br>
  {{/if}}
{{/props}}
</div>
`;

export class LayerTemplate
{
	static EmptyStringSet = new Set<string>();

	active: boolean = true;
	readonly title: string = "";
	readonly template: string;
	readonly options: {
		alias: {[key: string]: any},
		exclude: any,
		include: any		
	}

	constructor(
		def : {
			template: string,
			active: boolean,
			title: string,
			options: {
				alias: {[key: string]: any},
				exclude: any,
				include: any
			}
	  	}
	) {
		this.active = def.active;
		this.title = def.title;
		this.template = def.template;
		this.options = def.options;
	  }

	static FromObject(
		def: {
			active?: boolean,
			title?: string,
			template?: string
			options?: {
				alias?: {[key: string]: any},
				exclude?: any,
				include?: any,
			}
		}
	): LayerTemplate
	{
		if (!def.options)
			var opts = {alias: {}, exclude: {}, include: {}};
		else
			opts = {
				alias: def.options.alias ? this._normalizeOpt(def.options.alias) : {},
				exclude: def.options.exclude ? this._normalizeOpt(def.options.exclude) : this.EmptyStringSet,
				include: def.options.include ? this._normalizeOpt(def.options.include) : this.EmptyStringSet
			}

		return new LayerTemplate(
			{
				active: def.hasOwnProperty("active") ? def.active : true, 
				title: def.title ? def.title : "", 
				template: def.template.trim() != "default" ? def.template : BaseTemplate, 
				options: opts
			});
	}

	static _normalizeOpt(opt)
	{		
		let normalize = subopt =>
		{
			if (Array.isArray(subopt)) {
				return new Set<string>(subopt);
			} else if (typeof(subopt) === "string") {
				return subopt;
			}else {
				let norm = {};

				Object.keys(subopt).forEach(key => {
					norm[key] = normalize(subopt[key]);
				})

				return norm;
			}
		};

		return normalize(opt);
	}
}

export class MouseOverTemplate
{
	active: boolean;
	div: HTMLDivElement;
	layerId: string;


	_def: LayerTemplate;
	
	_tmpl: JsViews.Template;

	constructor(id: string, def: LayerTemplate)
	{
		this.layerId = id;
		this.active = def.active;
		this._def = def

		if (def.template.trim())
		{
			try {
				this._tmpl = $.templates({
					markup: def.template,
					helpers: {isNotDict: (p => {return p.constructor != Object})}
				});
			} catch(err) {
				this._tmpl = null;
				this._def.active = false;
				this.active = false;
			}
		} else {
			this._tmpl = null;
			this._def.active = false;
			this.active = false;
		}
	}

	divy(data: {[key: string]: any}): HTMLDivElement {
		if (data)
		{
			if (!this.div) {
				let tmp = document.createElement("div");

				tmp.setAttribute("class", "template-div");
				tmp.style.display = "none";
				tmp.style.fontSize = "0.618em";
				tmp.style.padding = "13px";
				tmp.style.width = "100%";
				this.div = tmp;
			}

			if (data)
				console.log(`DATA BEFORE: ${Object.keys(data)}`);

			let exc = this._def.options.exclude;
			let inc = this._def.options.include;

			if (
				(typeof(inc) === "string" && inc.length > 0) ||
				(inc.constructor == Set && inc.size > 0) ||
				Object.keys(inc).length > 0
			)
				data = this._include(data);
			else if (
				(typeof(inc) === "string" && exc.length > 0) ||
				(exc.constructor == Set && exc.size > 0) ||
				Object.keys(exc).length > 0
			)
				data = this._exclude(data);

			if (data)
				console.log(`DATA AFTER: ${Object.keys(data)}`)

			try {
				var html = this._tmpl(data);
			} catch(err) {
				html = "";
			}

			if (html) {
				console.log(`Template HTML BEFORE: ${html}`)

				if (Object.keys(this._def.options.alias).length > 0) 
					html = this._alias(html);

				if (this._def.title.trim()) {
					this.div.innerHTML = `<h3>${this._def.title}</h3><br>${html}`
				}
				else
				{
					this.div.innerHTML = html;
				}

				this.div.style.display = "block";
			}
			else {
				this.div.style.display = "none";
				return null;
			}

			console.log(`Template HTML AFTER: ${html}`)
			return this.div;	
		}
	}

	_exclude(data: {[key: string]: any})
	{
		let innerx = (idata, iexclude) => {
			if (iexclude.constructor == Set)
			{
				let included = {};

				Object.keys(idata).forEach(ikey => {
					if (!(iexclude.has(ikey)))
						included[ikey] = idata[ikey];
				});

				return included;
			}
			else if (typeof(iexclude) === "string")
			{
				let included = {}

				Object.keys(idata).forEach(ikey => {
					if (ikey !== iexclude)
						included[ikey] = idata[ikey];
				})

				return included;
			}
			else
			{
				let included = {}

				Object.keys(idata).forEach(ikey => {
					if (!(ikey in iexclude)) {
						included[ikey] = idata[ikey]
					} else if (iexclude[ikey].length > 0) {
						included[ikey] = innerx(idata[ikey], iexclude[ikey]);
					}
				});

				return included;
			}
		}

		return innerx(data, this._def.options.exclude)
	}

	// _exclude(data: {[key: string]: any})
	// {
	// 	var exclude = this._def.options.exclude;
	// 	let innerExclude = (dict: {[key: string]: any}) =>
	// 	{
	// 		var copy = {}

	// 		for (const label in dict)
	// 		{
	// 			if (!(label in exclude))
	// 			{
	// 				copy[label] = dict[label].constructor != Object ? dict[label] : innerExclude(dict[label]); 
	// 			}
	// 		}

	// 		return copy;
	// 	}

	// 	return innerExclude(data);
	// }

	_include(data: {[key: string]: any})
	{
		let innern = (idata, iinclude) => {
			if (iinclude.constructor == Set)
			{
				let included = {};

				Object.keys(idata).forEach(ikey => {
					if ((iinclude.has(ikey)))
						included[ikey] = idata[ikey];
				});

				return included;
			}
			else if (typeof(iinclude) === "string")
			{
				if (iinclude in idata)
				{
					if (
						(typeof(idata[iinclude]) === "string" && idata[iinclude].length > 0) ||
						(Object.keys(idata[iinclude]).length > 0))
						return {iinclude: idata[iinclude]}
				}

				return {}
			}
			else
			{
				let included = {}

				Object.keys(idata).forEach(ikey => {
					if (ikey in iinclude)
						included[ikey] = innern(idata[ikey], iinclude[ikey]);
				})

				return included;
			}
		}

		return innern(data, this._def.options.include)
	}

	// _include(data: {[key: string]: any})
	// {
	// 	var include = this._def.options.include;
	// 	let innerInclude = (dict: {[key: string]: any}) =>
	// 	{
	// 		var copy = {}

	// 		for (const label in dict)
	// 		{
	// 			if ((label in include))
	// 			{
	// 				copy[label] = dict[label].constructor != Object ? dict[label] : innerInclude(dict[label]); 
	// 			}
	// 		}

	// 		return copy;
	// 	}

	// 	return innerInclude(data);
	// }

	_alias(html: string)
	{
		var alias = this._def.options.alias;
		for (const name in alias)
			html = html.replace(`${name}:`, `${alias[name]}:`);

		return html;
	}
}