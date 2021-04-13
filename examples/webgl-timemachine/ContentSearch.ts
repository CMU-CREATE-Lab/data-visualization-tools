// Data Library search

export class ContentSearch {
  $layerSearchClear: JQuery<HTMLElement>;
  $search: JQuery<HTMLInputElement>;
  $accordions: JQuery<HTMLElement>;
  $noSearchResultsFoundMsg: JQuery<HTMLElement>;
  searchTimer: ReturnType<typeof setTimeout>;
  searchTimeoutInMs: number;

  constructor() {}

  initialize() {
    let that = this;

    this.$layerSearchClear = $("#layer-search-clear-icon");
    this.$search = $('#layer-search-box');
    this.$accordions = $('.map-layer-div .ui-accordion-header');
    this.$noSearchResultsFoundMsg = $("#layer-search-results-empty-msg");

    this.$layerSearchClear.on("click", function() {
      that.$search.val("").trigger("input");
    });

    this.$search.on('input', function() {
      clearTimeout(that.searchTimer);
      // val() on an HTMLInput is always a string. We can either ignore or use toString(). It's wasteful to do the latter, so we ignore our TS overlords.
      // @ts-ignore
      let searchText = that.$search.val().toLowerCase().trim();
      if (searchText.length == 0) {
        that.searchTimeoutInMs = 0;
        that.$layerSearchClear.hide();
        that.$search.val("").trigger("focus");
      } else {
        that.searchTimeoutInMs = 300;
        that.$layerSearchClear.show();
      }
      that.searchTimer = setTimeout(function() {
        let openCategories = $("#layers-menu h3.ui-accordion-header.ui-state-active");
        let found = false;
        let layerCategoriesToOpen = [];

        var hideAccordion = function($accordion, accordion, openIndex) {
          if (openIndex >= 0) {
            $('.ui-accordion-header-icon', $accordion).removeClass('ui-icon-triangle-1-s').addClass('ui-icon-triangle-1-e');
            $accordion.attr("aria-selected", "false").removeClass("accordion-header-active ui-state-active").next().hide().removeClass("accordion-content-active");
          }
          accordion.style.display = "none";
        }

        for (const accordion of that.$accordions) {
          let $accordion = $(accordion);
          let $categoryLayers = $accordion.next().find("tr");
          let categoryLayerText = $categoryLayers.toArray().map(layerEntry => $(layerEntry)[0].innerText.toLowerCase()).join("    ");
          let categoryName = accordion.innerText.toLowerCase();
          var openIndex = openCategories.index(accordion);
          $categoryLayers.show();
          let searchTokens = searchText.split(/\s+/);
          var categoryMatch = searchTokens.every(str => categoryName.indexOf(str) >= 0);
          if (categoryMatch || searchTokens.every(str => categoryLayerText.indexOf(str) >= 0)) {
            found = true;
            accordion.style.display = "block";
            let hiddenLayersCount = 0;
            for (const layerEntry of $categoryLayers) {
              let layerEntryText = layerEntry.innerText.toLowerCase();
              if (searchTokens.some(str => layerEntryText.indexOf(str) == -1)) {
                layerEntry.style.display = "none";
                hiddenLayersCount++;
              }
            }
            if (!categoryMatch && hiddenLayersCount == $categoryLayers.length) {
              // If a category was open and we need to hide it because of no relevant search results, we close it first.
              hideAccordion($accordion, accordion, openIndex);
            } else {
              // If we end up hiding every layer in a category, but the search criteria matches the category name itself,
              // we unhide all the layers in it. We do this based on the assumption that someone was doing a very generic search
              // and since we don't have tags and our layer names are terrible at best, perhaps something in that category is actually
              // of interest.
              if (categoryMatch && hiddenLayersCount == $categoryLayers.length) {
                $categoryLayers.show();
              }
              // Match was found within a category.
              // If a category is not already open and the search box contains a search query, add to list of categories to open.
              if (openIndex == -1 && searchText.length > 0) {
                layerCategoriesToOpen.push(accordion);
              }
            }
          } else {
            // If a category was open and we need to hide it because of no relevant search results, we close it first.
            hideAccordion($accordion, accordion, openIndex);
          }
        }
        if (found) {
          that.$noSearchResultsFoundMsg.hide();
          let enableState, categories;
          if (searchText.length > 0) {
            enableState = "true";
            categories = layerCategoriesToOpen;
          } else {
            enableState = "false";
            categories = openCategories;
          }
          $('.ui-accordion-header-icon', categories).toggleClass('ui-icon-triangle-1-s').toggleClass('ui-icon-triangle-1-e');
          $(categories).attr("aria-selected", enableState).toggleClass("accordion-header-active ui-state-active").next().toggle().toggleClass("accordion-content-active");
        } else {
          that.$noSearchResultsFoundMsg.show();
        }
      }, that.searchTimeoutInMs);
    });
  }
}
