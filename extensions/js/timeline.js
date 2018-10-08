
var mouseX;
var customLabel;
var showToday = false;

$(window).resize(function () { loadData() });

$(document).mousemove(function (e) {
  mouseX = e.pageX + 20;
  if (mouseX > window.innerWidth - 200) { mouseX = mouseX - 250 };
});


function zoomIn() {
  var zoom = 1;
  if (sessionStorage.zoom != null) {
    var zoom = JSON.parse(sessionStorage.zoom);
    zoom = zoom + 1;
  }
  sessionStorage.zoom = JSON.stringify(zoom);
  showTimeline();
}

function zoomOut() {
  var zoom = 1;
  if (sessionStorage.zoom != null) {
    var zoom = JSON.parse(sessionStorage.zoom);
    if (zoom > 1) zoom = zoom - 1;
  }
  sessionStorage.zoom = JSON.stringify(zoom);
  showTimeline();
}

function showTimeline() {

  var zoom = 1;
  if (sessionStorage.zoom != null) {
    var zoom = JSON.parse(sessionStorage.zoom);
  }
  var navhelp = $("#zoomHelpText");
  if (zoom > 1) { navhelp.addClass("show") } else { navhelp.removeClass("show") };

  d3.select("svg").remove();

  var eventData = [];
  eventData.push({ label: " ", times: [{ "starting_time": 0 }] });

  if (sessionStorage.tracking != null) {
    var times = JSON.parse(sessionStorage.tracking);
    if (times.length > 0) eventData.push({ label: "Tracking", times })
  }
  if (sessionStorage.lifecycle != null) {
    var times = JSON.parse(sessionStorage.lifecycle);
    if (times.length > 0) eventData.push({ label: "Lifecycle", etype: "history", times })
  }
  if (sessionStorage.discussion != null) {
    var times = JSON.parse(sessionStorage.discussion);
    if (times.length > 0) eventData.push({ label: "Discussion", times })
  }
  if (sessionStorage.history != null) {
    var times = JSON.parse(sessionStorage.history);
    if (times.length > 0) eventData.push({ label: "History", times })
  }
  if (sessionStorage.custom != null) {
    var times = JSON.parse(sessionStorage.custom);
    if (times.length > 0) eventData.push({ label: customLabel, etype: "custom", times });
  }

  var colorScale = d3.scaleOrdinal()
    .range(['#000', '#2e3d98', '#111b58', '#7e929f', '#111b58', '#FF5733', '#319124', '#C70039', '#0000ff', '#111b58', '#09bcef'])
    .domain(['custom', 'history', 'discussion', 'comment', 'deadlineStart', 'deadlineDue', 'deadlineMet', 'deadlineOverdue', 'modified', 'lifecycle', 'lifecycleTask']);
  var width = window.innerWidth;
  var chart = d3.timelines()
    .width(width * zoom)
    .tickFormat(
      {
        format: d3.timeFormat("%d-%b-%y"),
        tickTime: d3.timeWeek,
        tickInterval: 1,
        tickSize: 10
      })
    .display("circle")
    .colors(colorScale)
    .colorProperty('etype')
    .stack()
    .showToday(showToday)
    .showTodayFormat({ marginTop: 20, marginBottom: 50, width: 1, color: "#09bcef" })
    .itemHeight(12)
    .rowSeparators('#ccc')
    .itemMargin(4)
    .margin({ left: 80, right: 50, top: 0, bottom: 0 })
    .mouseover(function (d, i, datum) {
      // d is the current rendering object
      // i is the index during d3 rendering
      // datum is the id object
      var parts = d.label.split('|');
      var popup = $("#myPopup");
      popup.css('left', mouseX);
      popup.append('<div>' + parts[0] + '</div>');
      if (parts.length > 1) popup.append('<div style="float:right;font-size:10px">' + parts[1] + '</div>');
      popup.addClass("show");
    })
    .mouseout(function (d, i, datum) {
      var popup = $("#myPopup");
      popup.removeClass("show");
      popup.empty();
    })
    .scroll(function (x, scale) {
      var navhelp = $("#zoomHelpText");
      navhelp.removeClass("show");
    });


  var svg = d3.select("#timeline3").append("svg").attr("width", width).datum(eventData).call(chart);

}

function loadData() {
  var urlParams = new URLSearchParams(window.location.search);
  var id = urlParams.get('id');
  var include = urlParams.get('include');
  var baseUrl = urlParams.get('url');
  if (window.location.search.indexOf('show_today') > -1) showToday = true;
  if (include == null) include = "history";
  if (baseUrl == null || id == null) {
    $("#zoomHelpText").empty();
    $("#zoomHelpText").append("<div>Unable to load timeline information</div>");
    /*$("#zoomHelpText").append("<div>&lt;url_to_component&gt;?url={system.baseURL}&include=&lt;options&gt;&id={item.Identity.ItemId}</div>");
    $("#zoomHelpText").append("<div><br/>The options for the include value are history,lifecycle,tracking,discussion and custom</div>");
    $("#zoomHelpText").append("<div><br/>The 'custom' setting requires this additional syntax:</div>");
    $("#zoomHelpText").append("<div>custom[entity_name:date_property:title_property];</div>");
    $("#zoomHelpText").append("<div>for example custom[CourtDates:HearingDate:Title];</div>");*/
    $("#zoomHelpText").addClass("show");
  } else {
    getEvents(id, include, baseUrl);
    getHistory(id, include, baseUrl);
    getComments(id, include, baseUrl);
  }
}

function getEvents(id, include, baseUrl) {
  if (include.indexOf('custom') > -1) {
    var eventDef = include.substring(include.indexOf('[') + 1, include.indexOf("]"));
    var eventParts = eventDef.split(':');
    customLabel = eventParts[0];
    var url = baseUrl + 'app/entityRestService/Items(' + id + ')/' + eventParts[0];
    $.get(url, function (response, status) {
      saveEvents(response, include, eventParts[1], eventParts[2]);
    });
  } else {
    sessionStorage.removeItem("custom");
  }
}

function getHistory(id, include, baseUrl) {
  var url = baseUrl + 'app/entityRestService/Items(' + id + ')/History';
  $.get(url, function (response, status) {
    saveHistory(response, include);
  });
}

function getComments(id, include, baseUrl) {
  var url = baseUrl + 'app/entityRestService/Items(' + id + ')?language=en-US&include=All%2CRelation.ToOne.TargetGhostItem';
  $.get(url, function (response, status) {
    saveComments(response, include);
  });
}

function saveEvents(events, include, date, title) {
  var times = [];
  for (var i = 0; i < events.items.length; i++) {
    var eventDate = new Date(events.items[i].Properties[date]);
    var eventName;
    if (title == 'Title') {
      eventName = events.items[i].Title.Title;
    } else {
      eventName = events.items[i].Properties[title];
    }
    times.push({ label: eventName + '|' + eventDate.toLocaleTimeString(), "starting_time": eventDate.getTime(), "ending_time": eventDate.getTime() });
  }
  sessionStorage.custom = JSON.stringify(times);
  showTimeline();
}

function saveHistory(events, include) {
  if (include.indexOf('history') > -1) {
    var times = [];
    for (var i = 0; i < events.History.length; i++) {
      var add = true;
      eventTitle = events.History[i].Description;
      // If certain events are tohave their own dataset, exclude from history which includes everything
      if (eventTitle.startsWith("Lifecycle") && include.indexOf('lifecycle') > -1) add = false;
      if (eventTitle.startsWith("Task") && include.indexOf('lifecycle') > -1) add = false;
      if (eventTitle.startsWith("Deadline") && include.indexOf('tracking') > -1) add = false;
      if (eventTitle.startsWith("Discussion") && include.indexOf('discussion') > -1) add = false;
      if (eventTitle.startsWith("\'Discussions\'") && include.indexOf('discussion') > -1) add = false;
      if (eventTitle.startsWith("Draft")) add = false;
      if (eventTitle.startsWith("\'LifecycleTask\'")) add = false;
      if (eventTitle.indexOf("\'DeadlineInstance\'") > -1) add = false;

      if (add) {
        eventDate = new Date(events.History[i].When);
        eventAuthor = events.History[i].Who;
        eventDetails = events.History[i].Description + '|' + eventAuthor + ' at ' + eventDate.toLocaleTimeString();
        var eventType = "history";
        if (eventTitle.startsWith("Lifecycle")) eventType = "lifecycle";
        if (eventTitle.startsWith("Task")) eventType = "lifecycleTask";
        if (eventTitle.startsWith("\'DeadlineInstance")) eventType = "deadlineStart"
        if (eventTitle.startsWith("Deadline")) eventType = "deadlineDue";
        if (eventTitle.startsWith("\'Discussions")) eventType = "discussion";
        if (eventTitle.startsWith("Discussion")) eventType = "discussion";
        times.push({ etype: eventType, label: eventDetails, "starting_time": eventDate.getTime(), "ending_time": eventDate.getTime() });
      }
    }
    sessionStorage.history = JSON.stringify(times);
    showTimeline();
  } else {
    sessionStorage.removeItem("history");
  }

  if (include.indexOf('lifecycle') > -1) {
    var times = [];
    for (var i = 0; i < events.History.length; i++) {
      var eventAction = events.History[i].Description;
      var eventDetails;
      if (eventAction.startsWith("Lifecycle") || eventAction.startsWith("Task")) {
        eventDate = new Date(events.History[i].When);
        if (eventAction.startsWith("Lifecycle") && eventAction.indexOf(' is created') > 0) {
          eventAction = 'Lifecycle ' + eventAction.substring(eventAction.indexOf(' is created'));
        } else if (eventAction.startsWith("Lifecycle") && eventAction.indexOf(' has') > 0) {
          eventAction = 'Lifecycle ' + eventAction.substring(eventAction.indexOf(' has'));
        };
        eventDetails = eventAction + "|" + eventDate.toLocaleTimeString();
        eventType = "lifecycle";
        if (eventAction.startsWith("Task")) eventType = "lifecycleTask";
        times.push({ etype: eventType, label: eventDetails, "starting_time": eventDate.getTime(), "ending_time": eventDate.getTime() });
      }
    }
    sessionStorage.lifecycle = JSON.stringify(times);
    showTimeline();
  } else {
    sessionStorage.removeItem("lifecycle");
  }
}


function saveComments(events, include) {
  // The data received for this call also has deadlines and tracking etc.

  // Process comments first
  if (include.indexOf('discussion') > -1) {
    var times = [];
    for (var i = 0; i < events.item.Discussions.length; i++) {
      eventDate = new Date(events.item.Discussions[i].Discussion.PostedDateTime);
      eventTime = eventDate.toLocaleTimeString();
      eventAuthor = events.item.Discussions[i].Discussion.Author;
      var eventDetails = "";
      var eventType = "discussion";
      if (events.item.Discussions[i].Discussion.TopicName != null && events.item.Discussions[i].Discussion.Body != null) {
        eventDetails = events.item.Discussions[i].Discussion.TopicName + ': ' + events.item.Discussions[i].Discussion.Body;
      } else if (events.item.Discussions[i].Discussion.TopicName != null && events.item.Discussions[i].Discussion.Body == null) {
        eventDetails = events.item.Discussions[i].Discussion.TopicName;
      } else {
        eventType = "comment";
        eventDetails = events.item.Discussions[i].Discussion.Body;
      }
      eventDetails = eventDetails + '|' + eventAuthor + ' at ' + eventTime;
      times.push({ etype: eventType, label: eventDetails, "starting_time": eventDate.getTime(), "ending_time": eventDate.getTime() });
    }
    sessionStorage.discussion = JSON.stringify(times);
    showTimeline();
  } else {
    sessionStorage.removeItem("discussion");
  }

  // Process tracking, including deadlines
  if (include.indexOf('tracking') > -1) {
    var times = [];
    for (var i = 0; i < events.item.DeadlineInstance.length; i++) {
      eventDateStart = new Date(events.item.DeadlineInstance[i].Properties.StartDate);
      eventDateDue = new Date(events.item.DeadlineInstance[i].Properties.DueDate);
      eventTitle = events.item.DeadlineInstance[i].Properties.DeadlinePolicyName;
      eventStatus = events.item.DeadlineInstance[i].Properties.Status;
      var now = new Date();
      var eventType = "deadlineDue";
      var eventState = "due";
      if (eventDateDue < now && eventStatus == "InProgress") {
        eventState = "overdue";
        eventType = "deadlineOverdue";
      }
      if (eventStatus == "Completed"){
        eventState = "completed";
        eventType = "deadlineMet";
      }
      var eventStartDetails = 'Deadline ' + eventTitle + ' triggered|' + eventDateStart.toLocaleTimeString();
      var eventDueDetails = 'Deadline ' + eventTitle + ' '+eventState+'|' + eventDateDue.toLocaleTimeString();
      times.push({ etype: "deadlineStart", label: eventStartDetails, "starting_time": eventDateStart.getTime(), "ending_time": eventDateStart.getTime() });
      times.push({ etype: eventType, label: eventDueDetails, "starting_time": eventDateDue.getTime(), "ending_time": eventDateDue.getTime() });
    }
    eventModifiedDate = new Date(events.item.Tracking.LastModifiedDate);
    times.push({ etype: "modified", label: "Last Modified|" + eventModifiedDate.toLocaleTimeString(), "starting_time": eventModifiedDate.getTime(), "ending_time": eventModifiedDate.getTime() });
    sessionStorage.tracking = JSON.stringify(times);
    showTimeline();
  } else {
    sessionStorage.removeItem("tracking");
  }

}

window.onload = function () {
  var urlParams = new URLSearchParams(window.location.search);
  var refresh = urlParams.get('refresh');
  if (refresh != null) {
    window.setInterval(loadData,refresh*1000);
  }

  loadData();
};
