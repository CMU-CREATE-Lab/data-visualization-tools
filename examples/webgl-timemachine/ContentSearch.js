function ContentSearch($searchInput, $searchResults) {
  this.$searchInput = $searchInput;
  this.$searchResults = $searchResults;
  this.$searchInput.on("input", this.updateSearch.bind(this));
}

ContentSearch.prototype.updateSearch = function() {
  var trimmed = this.$searchInput.val().trim();
  var searchTokens = trimmed.toLowerCase().split(/\s+/);
  for (var i = 0; i < this.layers.length; i++) {
    var layer = this.layers[i];
    var show = true;
    for (var j = 0; j < searchTokens.length; j++) {
      if (!layer.search.includes(searchTokens[j])) {
	show = false;
	break;
      }
    }
    if (trimmed.length && show) {
      layer.$elt.show();
    } else {
      layer.$elt.hide();
    }
  }
}

ContentSearch.prototype.labelChecked = function(elt) {
  return $('input:checked', elt).length > 0;
}

ContentSearch.prototype.changeSelection = function(layer) {
  var searchChecked = this.labelChecked(layer.$elt);
  var masterChecked = this.labelChecked(layer.master);
  if (searchChecked != masterChecked) {
    $('input', layer.master)[0].dispatchEvent(new MouseEvent('click', {clientX:100, clientY:100}));
    setTimeout(this.updateLayerSelectionsFromMaster.bind(this), 100);
  }
}

ContentSearch.prototype.copyLayerChecked = function(layer) {
  if (this.labelChecked(layer.$elt) != this.labelChecked(layer.master)) {
    $('input', layer.$elt).prop('checked', this.labelChecked(layer.master));
  }
}

ContentSearch.prototype.updateLayerSelectionsFromMaster = function() {
  var before = new Date().getTime();
  var masterChecked = $('input:checked', $('#layers-list')).parent();
  var searchChecked = $('input:checked', this.$searchResults).parent();
  var layersToCheck = new Set();
  for (var i = 0; i < masterChecked.length; i++) {
    layersToCheck.add(this.masterLabel2Layer.get(masterChecked[i]));
  }
  for (var i = 0; i < searchChecked.length; i++) {
    layersToCheck.add(this.searchLabel2Layer.get(searchChecked[i]));
  }
  layersToCheck.forEach(this.copyLayerChecked.bind(this));
}

ContentSearch.prototype.reset = function() {
  var before = new Date().getTime();
  var layersAndCategories = $('h3, label', $('#layers-list'));
  this.layers = [];
  this.masterLabel2Layer = new Map();
  this.searchLabel2Layer = new Map();
  var category;
  this.$searchResults.empty();
  for (var i = 0; i < layersAndCategories.length; i++) {
    var elt = layersAndCategories[i];
    if (elt.tagName == "LABEL") {
      var layer = {
	search: elt.innerText.toLowerCase(),
	category: category,
	master: elt
      };
      var checkbox = $('<input type="checkbox">').change(this.changeSelection.bind(this, layer));
      layer.$elt = $('<label/>').append(checkbox).append(' ' + elt.innerText).css('display','block').css('text-align','left').hide();
      this.$searchResults.append(layer.$elt);
      this.masterLabel2Layer.set(layer.master, layer);
      this.searchLabel2Layer.set(layer.$elt[0], layer);
      this.layers.push(layer);
    } else {
      category = {
	$elt: $('<div/>').text(elt.innerText).hide()
      };
      this.$searchResults.append(category.$elt);
    }
  }
  this.$searchInput.val('');
  this.updateSearch();
  this.$searchInput.focus();
  this.updateLayerSelectionsFromMaster();
}


