/*
 Web Historian - see webhistorian.org for more information

 Copyright (C) 2016  Ericka Menchen-Trevino, info@webhistorian.org

 This program is free software; you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation; either version 2 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License along
 with this program; if not, write to the Free Software Foundation, Inc.,
 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA. 
 */

define(["moment", "../app/config", "../app/utils"], function (moment, config, utils) 
{
    //if (last upoad date === never) {
	    //window.onbeforeunload = function (e) {
	    //e = e || window.event;
	    //return 'Will you consider opting-in to the research project? Click the cloud icon.';
		//};
	//}
    
    var history = {};
    
    history.fullData = [];
    history.timeSelection = "all";
    history.earliestTimestamp = Number.MAX_VALUE;
    history.latestTimestamp = Number.MIN_VALUE;
    history.urlArray = [];
    
    var startDate = null;
    var endDate = null;

    var manifest = chrome.runtime.getManifest();

//globals 
    var divName = "visual_div";
    var now = new Date();
    var timeSelect = 0; //null = 24 hours, 0 = all time
    var dateLimit = new Date(now.getTime());
    dateLimit.setDate(now.getDate() - 91);
    var dateForward = Infinity;

    var vizSelected = null;
    var firstDate = "";
    var lastDate = "";
    var visualData = [];
    var ids = [];

//Getting data from Chrome History & creating the base dataset
    function getUrls(callback, viz, callback2) {
        var end = now.getTime();
        if (dateForward != Infinity) {
            end = dateForward;
        }

        chrome.history.search({
                'text': '',
                'maxResults': 0,
                'startTime': timeSelect
                //, 'endTime': end //not working
            },
            function (historyItems) {
                //list of hostnames
                
                for (var i = 0; i < historyItems.length; ++i) {
                    history.urlArray.push({
                        url: historyItems[i].url,
                        title: historyItems[i].title,
                        vc: historyItems[i].visitCount
                    });
                }

                //GetVisitsData
                var results = [];
                getVisitData(JSON.parse(JSON.stringify(history.urlArray)), results, callback, viz, callback2);
            });
    }

    function getVisitData(data, results, callback, viz, callback2) 
    {
        //gets visitItems from a supplied list of urls (as data)
        //used to determine last data element
        var itemCount = data.length;
        
        var lastPercentage = "";
        
        var fetchVisits = function()
        {
            var historyItem = data.pop();
            
            var currentProgress = (100 * ((itemCount - data.length) / itemCount)).toFixed(1) + '%';

            if (lastPercentage != currentProgress)
            {
                $("#visit_progress").width(currentProgress);
                $("#visit_progress").html(currentProgress);
                
                lastPercentage = currentProgress;
            }
        
            chrome.history.getVisits({url: historyItem.url}, function (visitItems) 
            {
                visitItems.forEach(function(visit) 
                {
                    if (visit.visitTime >= dateLimit && visit.visitTime <= dateForward) 
                    {                    	
                        results.push({
                            url: historyItem.url,
                            title: historyItem.title,
                            id: visit.id,
                            visitId: visit.visitId,
                            referringVisitId: visit.referringVisitId,
                            visitTime: visit.visitTime,
                            transitionType: visit.transition
                        });
                        
                        if (visit.visitTime < history.earliestTimestamp)
                            history.earliestTimestamp = visit.visitTime;

                        if (visit.visitTime > history.latestTimestamp)
                            history.latestTimestamp = visit.visitTime;
                        
                        ids.push({id: visit.id});
                    }
                });
                
                if (data.length > 1)
                    window.setTimeout(fetchVisits, 0);
                else
                {
                    $("#visit_progress").width("100%");
                    $("#visit_progress").html("100%");
                    
                    transformData(results, callback, viz, callback2);
                
                    $("input#start_date").datepicker("setDate", new Date(history.earliestTimestamp));
                    $("input#end_date").datepicker("setDate", new Date(history.latestTimestamp));
                }
            });     
        };
        
        window.setTimeout(fetchVisits, 0);
    }

    function transformData(data, callback, viz, callback2) {
        //original data has: url title id visitId referringVisitId visitTime transitionType

        if (history.fullData != []) {
            history.fullData = [];
        }

        var itemCount = data.length;
        
        var lastPercentage = '';
        
        var transformDataItem = function()
        {
            var currentProgress = (100 * ((itemCount - data.length) / itemCount)).toFixed(0) + '%';
            
            if (lastPercentage != currentProgress)
            {
                $("#transform_progress").width(currentProgress);
                $("#transform_progress").html(currentProgress);
                
                lastPercentage = currentProgress;
            }
            
            var activeItems = [];
            
            for (var i = 0; i < 100 && data.length > 0; i++)
                activeItems.push(data.pop());
                
            for (var i = 0; i < activeItems.length; i++)
            {    
                var dataItem = activeItems[i];
            
                var parser = document.createElement('a');
                parser.href = dataItem.url;
                var refId = dataItem.referringVisitId;
                var title = dataItem.title;
                // Try this for tab issues... 
                //if this ID is not in dataItem.visitID, subtract 1 from refId
				//    if (refId !== "0") {
				//        console.log("REF ID: " + refId);
				//    }

                var transType = dataItem.transitionType;
                var protocol = parser.protocol;
                var host = parser.hostname;
				
                var reGoogleMaps = /\.google\.[a-z\.]*\/maps/;
                var reGoogle = /\.google\.[a-z\.]*$/;
                var reGoogleOnly = /^google\.[a-z\.]*$/;
                var reBing = /\.bing\.com/;
                var reWwwGoogle = /www\.google\.[a-z\.]*$/;
                var reAol = /\.aol\.[a-z\.]*$/;
                var reBlogspot = /\.blogspot\.[a-z\.]*$/;
                var reYahoo = /\.yahoo\.[a-z\.]*$/;
                var reYahooSearchDomain = /search\.yahoo\.[a-z\.]*$/;
                var reAsk = /\.ask\.[a-z\.]*$/;
                var reThreeTwoThree = /^.*\.([\w\d_-]*\.[a-zA-Z][a-zA-Z][a-zA-Z]\.[a-zA-Z][a-zA-Z])$/;
                var reTwoTwoThree = /^.*\.([\w\d_-]*\.[a-zA-Z][a-zA-Z]\.[a-zA-Z][a-zA-Z])$/; 
                var reDefaultDomain = /^.*\.([\w\d_-]*\.[a-zA-Z][a-zA-Z][a-zA-Z]?[a-zA-Z]?)$/; 

                if (parser.href.match(reGoogleMaps)) {
                    domain = "google.com/maps";
                }
                else if (protocol === "chrome-extension:") {
                	if (title != ""){
                		domain = title + " Extension";
                	}
                	else {domain = "Chrome Extension";}  	
                }
                else if (protocol === "file:") {
                	domain = "Local File";
                }
                else if (host.match(reWwwGoogle) || host.match(reGoogleOnly)) {
                	domain = "google.com";
                }
                else if (host.match(reGoogle) || host.match(reBlogspot)) {
                    domain = host;
                }
                else if (host.match(reThreeTwoThree)) {
                	domain = host.replace(reTwoTwoThree, "$1");
                }
                else if (host.match(reTwoTwoThree)) {
                    domain = host.replace(reTwoTwoThree, "$1");
                }
                else {
                    domain = host.replace(reDefaultDomain, "$1");
                }

                reSearch = /q=([^&]+)/;
                reYahooSearch = /p=([^&]+)/;
                var searchTerms = "";

                if (reGoogle.test(host) || host === "duckduckgo.com" || reBing.test(host) || host === "search.aol.com" || host === reAsk.test(host)) {

                    if (reSearch.test(parser.href)) {
                        search = parser.href.match(reSearch, "$1");
                        if (search[1] != "")
                            var searchTerms1 = search[1];
                        var dcSearchTerms = decodeURIComponent(searchTerms1);
                        searchTerms = dcSearchTerms.replace(/\+/g, " ");
                    }
                }

                if (reYahooSearchDomain.test(host)) {

                    if (reYahooSearch.test(parser.href)) {
                        yahooSearch = parser.href.match(reYahooSearch, "$1");
                        if (yahooSearch[1] != "")
                            var searchTerms1 = yahooSearch[1];
                        var dcSearchTerms = decodeURIComponent(searchTerms1);
                        var searchTerms = dcSearchTerms.replace(/\+/g, " ");
                    }
                }
                history.fullData.push({
                    id: dataItem.visitId,
                    url: dataItem.url,
                    urlId: dataItem.id,
                    protocol: protocol,
                    domain: domain,
                    searchTerms: searchTerms,
                    date: dataItem.visitTime,
                    transType: dataItem.transitionType,
                    refVisitId: dataItem.referringVisitId,
                    title: dataItem.title
                });
            }
                
            if (data.length > 1)
                window.setTimeout(transformDataItem, 0);
            else
            {
                $("#transform_progress").width("100%");
                $("#transform_progress").html("100%");

                visualData = history.fullData;
                utils.sortByProperty(visualData,"date");
                console.log("visualData: ", visualData.length);
                callback2();
                callback(visualData, viz);
                
                $("#progress_bars").hide();
                
                chrome.storage.local.get({ 'upload_identifier': '' }, function (result) 
                {
					if (result.upload_identifier == "")
					{
						requirejs(["historian", "../app/config"], function (historian, config) 
						{
							historian.fetchUserId(config.fetchIdUrl, function(user_id) {
								console.log("1: " + user_id);
								
								$("#identifier_modal").modal("show");
						
								$("#field_identifier").val(user_id);
				
								$("#chose_identifier").click(function(eventObj)
								{
									eventObj.preventDefault();

									var identifier = $("#field_identifier").val();
	
									if (identifier != null && identifier != "")
									{
										chrome.storage.local.set({ 'upload_identifier': identifier }, function (result) 
										{
											$("#identifier_modal").modal("hide");
					
											// console.log("SAVED");
										});
				
										console.log("IDENTIFIER: " + identifier);
									}
						
									return false;
								});
							});
						});
					}
				});
            }
        };
        
        window.setTimeout(transformDataItem, 0);
    }

    history.findIndexArrByKeyValue = function(arraytosearch, key, valuetosearch) 
    {
        var indexArray = [];
        
        for (var i = 0; i < arraytosearch.length; i++) 
        {
            if (arraytosearch[i][key] === valuetosearch) 
            {
                indexArray.push(i);
            }
        }
        
        return indexArray;
    };
	
    history.getSuppressedUrl = function(data, key, value) 
    {
        var index = history.findIndexArrByKeyValue(data, key, value);
        var urlArray1 = [];

        index.forEach(function (a) {
            console.log("A: " + JSON.stringify(a, null, 2));

            var url = data[a].url;

            console.log("B: " + JSON.stringify(url, null, 2));

            var urlInd = utils.findIndexByKeyValue(history.urlArray, "url", url);

            console.log("C: " + JSON.stringify(urlInd, null, 2));
            
            console.log("D: " + JSON.stringify(history.urlArray[urlInd], null, 2));
            
            var vc = history.urlArray[urlInd].vc;
            
            urlArray1.push({url: url, visitCount: vc});
        });
        return urlArray1;
    };

    history.removeHistory = function(urls, isArray) {
        //urls is an array of objects (true) or a single object(false)

        if (isArray) {
            var urlsRemovedNow = 0;
            var visitsRemovedNow = 0;

            urls.forEach(function (a, b) {
                var visits = a.visitCount;
                var urls = a.url;
                chrome.history.deleteUrl({url: urls});
                if (a.url != b.url) {
                    urlsRemovedNow++;
                    visitsRemovedNow += visits;
                }
            });

            var d = new Date();
            var removalRecord = {timeRemoved: d.getTime(), numUrls: urlsRemovedNow, numVisits: visitsRemovedNow};
            storeRemovalData(removalRecord);
        }
        else {
            var visits = urls.visitCount;
            var url1 = urls.url;
            var d = new Date();
            chrome.history.deleteUrl({url: url1});
            var removalRecord = {timeRemoved: d.getTime(), numUrls: 1, numVisits: visits};
            storeRemovalData(removalRecord);
        }
        
        getUrls(noTransform, noViz, function() {

        });
    };

    function storeRemovalData(data) {
        //add one object (data) to chrome local storage removal log, timeRemoved: , numUrls: , numVisits:
        var removalArray = [];
        var existing = getStoredData("removals");
        if (existing != null) {
            existing.push({timeRemoved: data.timeRemoved, numUrls: data.numUrls, numVisits: data.numVisits});
            localStorage.setItem("removals", JSON.stringify(existing));
        }
        else {
            var first = [];
            first.push({timeRemoved: data.timeRemoved, numUrls: data.numUrls, numVisits: data.numVisits});
            localStorage.setItem("removals", JSON.stringify(first));
        }
    }

    function getStoredData(key) {
        //get data in chrome local storage
        return JSON.parse(localStorage.getItem(key));
    }

    function onlyBetween(obj, property, lowVal, highVal) {
        //returns an array with only the property values between the high/low values specified
        var data = [];
        obj.forEach(function(a){
            var prop = a[property];
            if (prop >= lowVal && prop <= highVal) {
                data.push(a);
            }
        });
        return data;
    }
//Passing data to visualizations

    function submissionData(callback) {
//        loadTime();
        var userId = chrome.runtime.id;
        var removals = [];
        if (getStoredData("removals") != null) {
            removals.push(getStoredData("removals"));
        }
        else {
            removals.push({timeRemoved: null, numUrls: 0, numVisits: 0});
        }
        var finalData = {userId: userId, removed: removals, data: history.fullData};

        callback(finalData);
    }

    function noTransform(data, callback) {
//        loadTime();
        callback(data);
    }


    function noViz(data) {
        //nothing
    }

	history.compareWeekVisits = function(startDate, data, callback) {
		var weekAend = startDate;
		var weekAstart = new Date (startDate.getFullYear(),startDate.getMonth(),(startDate.getDate()-7) );
		var weekBstart = new Date (startDate.getFullYear(),startDate.getMonth(),(startDate.getDate()-14) );
		
		var weekAendNum = weekAend.getTime();
		var weekAstartNum = weekAstart.getTime();
		var weekBstartNum = weekBstart.getTime();
		
		//before this week data array, this week data array
		var twd = onlyBetween(data, "date", weekAstartNum, weekAendNum);
		var lwd = onlyBetween(data, "date", weekBstartNum ,weekAstartNum);
		var countA = twd.length;
		var countB = lwd.length;
		//search terms array (for each input)
		var stTwd = utils.generateTerms(twd);
		var stLwd = utils.generateTerms(lwd);
		//sort terms array
		var sStTwd = utils.sortByProperty(stTwd,"term");
		var sStLwd = utils.sortByProperty(stLwd,"term");
		//unique search terms array (for each)
		var ustTwd = utils.uniqueCountST(sStTwd, "term");
		var ustLwd = utils.uniqueCountST(sStLwd, "term");
		//search words array (for each)
		var swTwd = utils.searchTermsToWords(ustTwd);
		var swLwd = utils.searchTermsToWords(ustLwd);
		//sort words
		var sSwTwd = utils.sortByProperty(swTwd, "word");
		var sSwLwd = utils.sortByProperty(swLwd, "word");
		//unique search words, cleaned and counted (for each input) - swbtw (search words before this week), swtw (search words this week) properties word, count
		var swlw = utils.searchWordsFun(sSwLwd, ustLwd);
		var swtw = utils.searchWordsFun(sSwTwd, ustTwd);
		var maxCountLwSize = Math.max.apply(Math,swlw.map(function(swlw){return swlw.size;}));
		var indexMaxCountLwSize = utils.findIndexByKeyValue(swlw,"size",maxCountLwSize);
		var maxCountTwSize = Math.max.apply(Math,swtw.map(function(swtw){return swtw.size;}));
		var indexMaxCountTwSize = utils.findIndexByKeyValue(swtw,"size",maxCountTwSize);

		//sort arrays by domain (this week data sorted domain)
		var lwdSd = utils.sortByProperty(lwd,"domain");
		var twdSd = utils.sortByProperty(twd,"domain");
		//unique domains with count (domains this week, domains last week)
		var dlw = utils.countsOfProperty(lwdSd, "domain");
		var dtw = utils.countsOfProperty(twdSd, "domain");
		//find the max value
		var maxDlw = Math.max.apply(Math,dlw.map(function(dlw){return dlw.count;}));
		var maxDtw = Math.max.apply(Math,dtw.map(function(dtw){return dtw.count;}));
		//find the index of the item with the max value
		var indexMaxCountLwDs = utils.findIndexByKeyValue(dlw,"count",maxDlw);
		var indexMaxCountTwDs = utils.findIndexByKeyValue(dtw, "count", maxDtw);
		//displaying results
		if (countA >countB) { percentML = "more than";} 
		if (countA < countB) { percentML = "less than"; }
		if (countA == countB) {	percentML = "the same as"; }
		var percent = Math.round(Math.abs( ((countA-countB) / (countB)) * 100));
		var topDomainLw = dlw[indexMaxCountLwDs].counter;
		var topDomainTw = dtw[indexMaxCountTwDs].counter;
		var topTermLw = swlw[indexMaxCountLwSize].text;
		var topTermTw = swtw[indexMaxCountTwSize].text;
		
		var weekCompareData = {
			weekAend: weekAend,
			weekAstart: weekAstart,
			weekBend: weekAstart,
			weekBstart: weekBstart,
			percent: percent,
			percentML: percentML,
			topDomainLw: topDomainLw,
			topDomainTw: topDomainTw,
			topTermLw: topTermLw,
			topTermTw: topTermTw
		};
		callback(weekCompareData);
	};
    
    history.wir = function(weekData) {
        $("#cards").append("<div id=\"wir\"></div>");
        $("#wir").html( function() {
            	var aEnd = moment(weekData.weekAend).format("ddd MMM D");
				var aStart = moment(weekData.weekAstart).format("ddd MMM D");
				var bEnd = moment(weekData.weekBend).format("ddd MMM D");
				var bStart = moment(weekData.weekBstart).format("ddd MMM D");
				var percent = weekData.percent;
				var percentML = weekData.percentML;
				var topDomainLw = weekData.topDomainLw;
				var topDomainTw = weekData.topDomainTw;
				var topTermLw = weekData.topTermLw;
				//var topTermListLw = weekData.topTermListLw;
				//problems implementing tooltips for this
				var topTermTw = weekData.topTermTw;
				//var topTermListTw = weekData.topTermListTw;
				
				if (lastUl > 1) {
					lastUlD = moment(lastUl).format("MMM DD, YYYY");
				}
				else {lastUlD = "Never";}
				
				if (topTermLw === topTermTw){
					topTermLwD = "the same";
				}
				else {topTermLwD = "<strong>" + topTermLw + " </strong>";}
				
				if (topDomainTw === topDomainLw) {
					topDomainLwD = "the same";
				}
				else { topDomainLwD = "<strong><a href=\"http://" + topDomainLw + "\" target=\"_blank\">" + topDomainLw + "</a></strong>";}
				
				var researchAd = "<div id=\"research\"><h3>Using Web Historian</h3><p>If you are over 18 years old and you live the U.S. you can take part in the research project \"<a href=\" http://www.webhistorian.org/participate/\" target=\"_blank\">Understanding Access to Information Online and in Context</a>.\" This project helps us understand our online world in more depth and with greater reliability than ever before. Just click the \"Participate in Research\" button <span class=\"glyphicon glyphicon-cloud-upload\"></span> above. Participating takes about 5 minutes and involves uploading your browsing data and completing a survey. Before you take part you can delete any data you don't want to share using the Data Table <a href=\"#\" title id=\"data_table\"> <span class=\"glyphicon glyphicon-list\"></span></a> above.</p></div>";
				var weekInReview = "<h3>Week in review</h3><p>This week (" + aStart + " to " + aEnd +  ")" + " you browsed the web <strong>" + percent + "% " + percentML + "</strong> last week (" + bStart + " to " + bEnd + ").</p> <p>The website you visited the most this week was <strong><a href=\"http://"+ topDomainTw +"\" target=\"_blank\">" + topDomainTw + "</a></strong>. It was " + topDomainLwD + " last week. For more details on web site visits see the Web Visits visual <span class=\"glyphicon glyphicon-globe\"></span></p> <p>The search term you used the most this week was <strong>"+ topTermTw +"</strong></div>. It was "+ topTermLwD +" last week. For more details on search term use see the Search Terms visual <span class=\"glyphicon glyphicon-search\"></span></p>";
				//Your central jumping-off point for browsing the web this week was * this week. It was * last week.
				var footer = "<hr><p>You last uploaded your browsing data on: "+ lastUlD +"</p> <p>For more information about Web Historian visit <a href=\"http://webhistorian.org\" target=\"blank\">http://webhistorian.org</a>.</p>";
				var thanks = "<h3>Thank you for participating!</h3><p>For more information about the project see \"<a href=\" http://www.webhistorian.org/participate/\" target=\"_blank\">Understanding Access to Information Online and in Context\"</a>. For updates on reports and further studies <a href=\"https://american.co1.qualtrics.com/SE/?SID=SV_3BNk0sU18jdrmct\" target=\"_blank\">click here to sign up</a></p>";
				
				//change to === for testing original view
            	if (lastUl !== "Never") {
            		return weekInReview + thanks + footer;
            	}
            	else { return researchAd + weekInReview + footer; }            	 
            });
    };
    
    //insert the code for the cards, but doesn't display them (display: none)
    history.insertCards = function (){
    	$("#cards").html("<div class=\"row\" id=\"viz_selector\" style=\"display: none;\">\
					<div class=\"col-sm-6 col-md-3\">\
						<a id=\"web_visit_card\">\
							<div class=\"thumbnail\">\
								<img src=\"images/visit.png\" alt=\"Web Visits\" />\
								<div class=\"caption\">\
									<h3>Web Visits</h3>\
									<p>\
										Circles sized by number of visits.\
									</p>\
								</div>\
							</div>\
						</a>\
					</div>\
				<div class=\"col-sm-6 col-md-3\">\
						<a id=\"search_words_card\">\
							<div class=\"thumbnail\">\
								<img src=\"images/wordCloud.png\" alt=\"Search Words\" />\
								<div class=\"caption\">\
									<h3>Search Terms</h3>\
									<p>\
										Words used in multiple web searches.\
									</p>\
								</div>\
							</div>\
						</a>\
					</div>\
					<div class=\"col-sm-6 col-md-3\">\
						<a id=\"network_card\">\
							<div class=\"thumbnail\">\
								<img src=\"images/network.png\" alt=\"Network\" />\
								<div class=\"caption\">\
									<h3>Network</h3>\
									<p>\
										Links between websites browsed from - to.\
									</p>\
								</div>\
							</div>\
						</a>\
					</div>\
					<div class=\"col-sm-6 col-md-3\">\
						<a id=\"data_table_card\">\
							<div class=\"thumbnail\">\
								<img src=\"images/table.png\" alt=\"Data Table\" />\
								<div class=\"caption\">\
									<h3>Data Table</h3>\
									<p>\
										See the details of each web visit with an option to delete specific records.\
									</p>\
								</div>\
							</div>\
						</a>\
					</div>");
    };
    
    //for click on logo
   // history.display = function(hist, data){
   // 	utils.clearVisualization();
   //		history.insertCards();
   //		$('#viz_selector').show();
   //		history.compareWeekVisits(now, data, history.wir);
//		return history.display;
  //  };
    
    //Putting it all together
    $("document").ready(function () 
    {
        $("#navbar").hide();
		chrome.storage.local.get('lastPdkUpload', function (result) {
        	lastUl = result.lastPdkUpload;
   		});
        history.insertCards();
        //Get all data into fullData1
        getUrls(noTransform, noViz, function()
        {
            //append images for visualization chooser
            $('#viz_selector').show();
            $("#navbar").show();

			history.compareWeekVisits(now, visualData, history.wir);

            $('#upload_modal').on('show.bs.modal', function (e) 
            {
                chrome.storage.local.get({ 'lastPdkUpload': 0, 'completedActions': [] }, function (result) 
                {
					$.get(config.actionsUrl, function(actions)
					{
						var lastUpload = 0;
						var latest = 0;
					
						if (result.lastPdkUpload != undefined)
							lastUpload = Number(result.lastPdkUpload);
						
						var dayBundles = {};
						var dayIndices = [];
								
						for (var i = 0; i < visualData.length; i++)
						{
							var date = moment(visualData[i]["date"]);
						
							var unixTimestamp = date.valueOf();

							if (unixTimestamp > lastUpload)
							{
								var dayString = date.format("MMMM Do");
					
								var dayList = dayBundles[dayString];
					
								if (dayList == undefined)
								{
									dayList = [];
									dayBundles[dayString] = dayList;
									dayIndices.push(dayString);
								}
					
								dayList.push(visualData[i]);
							
								if (unixTimestamp > latest)
									latest = unixTimestamp;
							}
							else
							{
								// Already uploaded - ignore...
							}
						}
            
            			if (dayIndices.length > 0)
            			{
            				if (dayIndices.length == 1)
								$("#modal_overview").html("1 day to upload (" + dayIndices[0]+ ").");
							else
								$("#modal_overview").html(dayIndices.length + " days to upload (" + dayIndices[0] + " to " + dayIndices[dayIndices.length - 1] + ").");

							var toList = [];
					
							for (var j = 0; j < actions.length; j++)
							{
								var action = actions[j];
						
								var complete = false;

								for (var i = 0; i < result.completedActions.length; i++)
								{
									if (result.completedActions[i] == action["identifier"])
										complete = true;
								}

								if (complete == false)
									toList.push(action);
							}
						
							var myid = chrome.runtime.id;
					
							if (toList.length == 0)
							{
								$("div#progress_actions").hide();
							}
							else
							{
								$("div#progress_actions").show();
						
								var output = "";
						
								for (var i = 0; i < toList.length; i++)
								{
									var listItem = "<li>";
							
									listItem += "<a href='" + toList[i].url + myid + "' target='_blank' class='wh_action' id='wh_" + toList[i].identifier + "'>" + toList[i].name + "</a>";
							
									listItem += "</li>";
							
									output += listItem;
								}
						
								$("ul#progress_actions_list").html(output);
							}
						
							$("a.wh_action").click(function(eventObj)
							{
								var actionId = $(eventObj.target).attr("id").substring(3);
							
								result.completedActions.push(actionId);

								chrome.storage.local.set({ 'completedActions': result.completedActions }, function (result) 
								{
									// console.log("SAVED");
								});
							});

							$("#upload_data").click(function()
							{
								var bundles = [];
					
								for (var i = 0; i < dayIndices.length; i++)
								{
									bundles.push(dayBundles[dayIndices[i]]);
								}
					
								var onProgress = function(index, total)
								{
									var percentComplete = (index / total) * 100;
					
									$("#upload_progress").css("width", percentComplete + "%");
								};
					
								var onComplete = function()
								{
									chrome.storage.local.set({ 'lastPdkUpload': latest }, function (result) 
									{
										$('#upload_modal').modal('hide');
								
										chrome.browserAction.setIcon({
											path: "images/star-yellow-64.png"
										});	

										chrome.browserAction.setTitle({
											title: "Web Historian"
										});	
									});
								};

								chrome.storage.local.get({ 'upload_identifier': '' }, function (result) 
								{
									requirejs(["passive-data-kit", "crypto-js-md5"], function(pdk, CryptoJS) 
									{
										pdk.upload(config.uploadUrl, CryptoJS.MD5(result.upload_identifier).toString(), 'web-historian', bundles, 0, onProgress, onComplete);
									});                 
								});
							});
						}
						else
						{
							$('#upload_modal').modal("hide");
							
							alert("You have already uploaded your data.");
						}
                    });
                });
            });

            $("#submit").click(function() {
                d3.selectAll("#viz_selector a").classed("active", false);
                dateForward = Infinity;
                history.timeSelection = "all";
            });
            
			$("#link_access_server").click(function(eventObj)
			{
				eventObj.preventDefault();

				chrome.storage.local.get({ 'upload_identifier': '' }, function (result) 
				{
					requirejs(["passive-data-kit", "crypto-js-md5"], function(pdk, CryptoJS) 
					{
						var now = new Date();
						
						var month = "" + (now.getMonth() + 1);
						var day = "" + now.getDate();
						
						if (month.length < 2)
						{
							month = '0' + month;
						}

						if (day.length < 2)
						{
							day = '0' + day;
						}
						
						var isoDate = now.getFullYear() + '-' +  month + '-' + day;
						
						var sourceId = CryptoJS.MD5(CryptoJS.MD5(result.upload_identifier).toString() + isoDate).toString();
						
						var newURL = config.reviewUrl + sourceId;
						chrome.tabs.create({ url: newURL });
					});                 
				});
				
				return false;
			});

        });
    });

    return history;
});
