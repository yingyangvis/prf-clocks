// define svg canvas and vis variables
const margin = { top: 50, right: 100, bottom: 50, left: 100 },
    width = window.innerWidth - margin.left - margin.right,
    height = window.innerHeight - margin.top - margin.bottom;

const faceBubbleRadius = 30, faceBubbleStrokeWidth = 10, faceBubbleGap = 6,
    faceImageWidth = 35, faceOffset = 9.5, biggerFaceOffset = 9,
    clockOpacity = .15, bandOpacity = 1,
    snippetWidth = 280, snippetHeight = 120, snippetGap = 30, snippetStacksNum = 12,
    callOutSnippetWidth = 500,
    transitDuration = 1000;

const svg = d3.select("#canvas")
    .append("svg")
    .attr("width", width + margin.left + margin.right - 10)
    .attr("height", height + margin.top + margin.bottom - 20),
    visGroup = svg.append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

let resizeId;
$(window).resize(function () {
    clearTimeout(resizeId);
    resizeId = setTimeout(() => { location.reload(); }, 100);
});

d3.selection.prototype.moveToFront = function () {
    return this.each(function () {
        this.parentNode.appendChild(this);
    });
};

// define colour palette
const affiliationColours = {
    "Australian Greens": "#088c44",
    "Australian Labor Party": "#e43944",
    "Independent": "#248ca4",
    "Liberal Party of Australia": "#1c4c9c",
    "National Party of Australia": "#f7d105"
};
const diffColourScale = d3.scaleSequential(d3.interpolatePiYG);

// load data
const speechData = await d3.json("data/results_speaker_affil.json");
const diffData = await d3.csv("data/results_speaker_affil_summary_table_affiliation.csv");

const faceIdDict = {
    "Adam Bandt": 10734,
    "Alicia Payne": 10919,
    "Andrew Giles": 10812,
    "Andrew Leigh": 10746,
    "Andrew Wallace": 10896,
    "Anthony Norman Albanese": 10007,
    "Barnaby Thomas Gerard Joyce": 10350,
    "Bill Richard Shorten": 10580,
    "David Littleproud": 10890,
    "Gordon Reid": 10996,
    "Graham Douglas Perrett": 10512,
    "Helen Haines": 10929,
    "Josh Burns": 10934,
    "Julian Leeser": 10888,
    "Kate Chaney": 10974,
    "Kate Thwaites": 10930,
    "Linda Burney": 10858,
    "Luke Gosling": 10877,
    "Madeleine King": 10884,
    "Mark Alfred Dreyfus": 10181,
    "Matt Thistlethwaite": 10762,
    "Michael McCormack": 10743,
    "Milton Dick": 10880,
    "Peta Murphy": 10924,
    "Peter Craig Dutton": 10188,
    "Scott John Morrison": 10468,
    "Sharon Claydon": 10805,
    "Shayne Kenneth Neumann": 10485,
    "Tim Watts": 10794,
    "Warren Edward Snowdon": 10599,
    "Zali Steggall": 10941,
    "Zoe Daniel": 10979
};

diffColourScale.domain(d3.extent(speechData.map(d => d.diff)));

// process data
let diffDict = diffData.reduce((obj, item) => { Object.assign(obj, { [item.speaker]: { median: item.median, cluster: item.cluster } }); return obj; }, {});

let speakers = {},
    dates = [];
speechData.forEach(d => {

    const speaker = d.speaker;

    if (diffDict[speaker] === undefined) return;

    dates.push(d.date);
    d.formatedDate = d3.timeParse("%Y-%m-%d")(d.date);

    if (speakers[speaker] === undefined) {
        speakers[speaker] = {
            speaker: d.speaker,
            startDate: d.formatedDate,
            endDate: d.formatedDate,
            affiliation: d.affiliation,
            speeches: {},
            speechPie: [],
            median: Number(diffDict[speaker].median),
            cluster: diffDict[speaker].cluster
        };
        speakers[speaker].speeches[d.date] = d;
    }
    else {
        speakers[speaker].startDate = speakers[speaker].startDate < d.formatedDate ? speakers[speaker].startDate : d.formatedDate;
        speakers[speaker].endDate = speakers[speaker].endDate > d.formatedDate ? speakers[speaker].endDate : d.formatedDate;
        speakers[speaker].speeches[d.date] = d;
    }
});
dates = [...new Set(dates)].concat(["0000-00-00"]).sort().reverse();
let diffs = [],
    affiliationSpeakers = {},
    affiliationClusters = {};
Object.values(speakers).forEach(d => {

    diffs.push(d.median);

    const affiliation = d.affiliation;
    if (affiliationSpeakers[affiliation] === undefined) affiliationSpeakers[affiliation] = [];
    const obj = {
        speaker: d.speaker,
        median: d.median
    };
    affiliationSpeakers[affiliation].push(obj);

    if (affiliationClusters[affiliation] === undefined) affiliationClusters[affiliation] = {};
    affiliationClusters[affiliation][d.cluster] = d.median;

    const percent = 1 / (dates.length + faceBubbleGap);
    dates.forEach(date => {
        if (date == "0000-00-00") {
            d.speechPie.push({
                date: date,
                value: percent * faceBubbleGap,
                hasSpeech: 2
            })
        }
        else if (d.speeches[date] === undefined) {
            d.speechPie.push({
                date: date,
                value: percent,
                hasSpeech: 0
            });
        }
        else {
            d.speechPie.push({
                date: date,
                value: percent,
                hasSpeech: 1
            });
        }
    });
});
Object.entries(affiliationClusters).forEach(entry => {
    const sortable = Object.entries(entry[1]).sort(([, a], [, b]) => a - b);
    affiliationClusters[entry[0]] = sortable.map((item) => item[0]);
});
console.log(speakers);

// define X scale
const xScale = d3.scaleLinear()
    .domain(d3.extent(diffs))
    .range([0, width]);

// calculate bubble positions
let affiPosiDict = {},
    affiliationDomain = Object.keys(affiliationSpeakers);
Object.entries(affiliationSpeakers).forEach(entry => {

    entry[1].sort((a, b) => { return a.median - b.median; });

    let affiPosiCounter = 0;
    entry[1].forEach(item => {

        affiPosiCounter = 0;

        speakers[item.speaker].cx = xScale(item.median);
        speakers[item.speaker].y = affiPosiCounter;

        if (affiPosiDict[entry[0]] === undefined) {
            affiPosiDict[entry[0]] = {};
            affiPosiDict[entry[0]][affiPosiCounter] = speakers[item.speaker].cx;
        }
        else {
            affiPosiCounter = movePosition(entry[0], affiPosiCounter, item.speaker);
        }
    });

    affiliationDomain.push(entry[0] + (affiPosiCounter + 1));
});
function movePosition(affilication, counter, speaker) {

    if (affiPosiDict[affilication][counter] === undefined) {
        affiPosiDict[affilication][counter] = speakers[speaker].cx;
    }
    else {
        if (Math.abs(speakers[speaker].cx - affiPosiDict[affilication][counter]) <= faceBubbleRadius * 1.9) {

            counter += 1;
            speakers[speaker].y = counter;
            counter = movePosition(affilication, counter, speaker);

            if (counter % 2 == 0) affiliationDomain.push(affilication.slice(0, -counter));
            else affiliationDomain.push(affilication + counter);
        }
        else {
            affiPosiDict[affilication][counter] = speakers[speaker].cx;
        }
    }
    return counter;
}
affiliationDomain = [...new Set(affiliationDomain)];
affiliationDomain.sort().pop();

// define Y scale
const yScale = d3.scaleBand()
    .domain(affiliationDomain)
    .range([0, height]);

// plot bubble chart
const faceBubble = visGroup.selectAll("g")
    .data(Object.values(speakers))
    .join("g")
    .attr("opacity", 1)
    .attr("id", d => "group-" + faceIdDict[d.speaker]);

faceBubble.append("circle")
    .attr("id", d => "circle-" + faceIdDict[d.speaker])
    .attr("class", "clock")
    .attr("fill", "white")
    .attr("fill-opacity", 0)
    .attr("stroke", d => {
        const clusters = affiliationClusters[d.affiliation];
        const darkness = clusters.length > 3 ? (clusters.indexOf(d.cluster) - 2) / 2 : clusters.indexOf(d.cluster);
        d.darkness = darkness;
        return d3.color(affiliationColours[d.affiliation]).darker(darkness);
    })
    .attr("stroke-width", 0)
    .attr("opacity", 1)
    .attr("cx", d => d.cx)
    .attr("cy", d => {
        d.cy = d.y % 2 == 0 ? yScale(d.affiliation) - d.y / 2 * faceBubbleRadius * 1.8 : yScale(d.affiliation) + (d.y + 1) / 2 * faceBubbleRadius * 1.8;
        return d.cy;
    })
    .attr("r", faceBubbleRadius);

const pie = d3.pie().value(d => d.value).sort(null);
const arc = d3.arc()
    .innerRadius(faceBubbleRadius / 2 + faceBubbleStrokeWidth)
    .outerRadius(faceImageWidth);
faceBubble.each(item => {

    addFace(faceIdDict[item.speaker], (item.cx + margin.left - faceOffset), (item.cy + margin.top - faceOffset), item);

    const colour = d3.color(affiliationColours[item.affiliation]).darker(item.darkness);
    faceBubble.select("path")
        .data(pie(item.speechPie))
        .join("path")
        .attr("id", (d, i) => "donut-" + faceIdDict[item.speaker] + "-" + i)
        .attr("class", "donut-" + faceIdDict[item.speaker])
        .style("stroke", "white")
        .style("stroke-width", 0)
        .style("fill", d => d.data.hasSpeech == 2 ? "#FFFFFF" : colour)
        .style("opacity", d => d.data.hasSpeech == 0 ? clockOpacity : bandOpacity)
        .attr("d", arc)
        .attr("transform", "translate(" + item.cx + "," + item.cy + ")");
});

let viewMoved = false, viewMoving = false,
    mouseoveredFaceId, mouseoveredLeft, mouseoveredTop, mouseoveredEle;
function addFace(faceId, left, top, ele) {

    const newDiv = document.createElement("div");
    newDiv.setAttribute("class", "thumb");
    newDiv.id = "face-" + faceId;
    newDiv.style.backgroundImage = "url('all_profiles/" + faceId + ".jpg')";

    newDiv.style.left = left;
    newDiv.style.top = top;

    const parentDiv = document.getElementById("faces");
    parentDiv.appendChild(newDiv);

    newDiv.onmouseover = function () {
        if (viewMoved) return;
        MouseoverFace(ele, faceId, left, top);
    };

    newDiv.onmouseout = function () { if (!viewMoved) MouseoutFace(); };

    newDiv.onclick = function (event) {
        if (event.detail == 1 && !viewMoving) {
            if (!ele.mouseover) {
                MouseoutFace();
                MouseoverFace(ele, faceId, left, top);
            }
            ClickFace(ele);
        }
    };
}

function MouseoverFace(ele, faceId, left, top) {

    ele.mouseover = true;
    mouseoveredFaceId = faceId;
    mouseoveredLeft = left;
    mouseoveredTop = top;
    mouseoveredEle = ele;

    d3.select("#face-" + mouseoveredFaceId)
        .style("width", faceImageWidth * 1.5)
        .style("height", faceImageWidth * 1.5)
        .style("left", mouseoveredLeft - biggerFaceOffset)
        .style("top", mouseoveredTop - biggerFaceOffset);

    d3.selectAll("#group-" + faceId).moveToFront();
    d3.select("#circle-" + mouseoveredFaceId)
        .attr("r", faceBubbleRadius * 1.2)
        .attr("stroke-width", 2)
        .attr("fill-opacity", 1)
        .moveToFront();
    d3.selectAll(".donut-" + faceId).moveToFront();

    d3.select("#tooltip-container")
        .style("display", "block")
        .style("left", left)
        .style("top", top - 130);

    const tooltipText = "<b>Speaker: </b>" + ele.speaker + "<br/>" +
        "<b>Affiliation: </b>" + ele.affiliation + "<br/>" +
        "<b>Speech Snippet Count: </b>" + Object.keys(ele.speeches).length + "<br/>" +
        "<b>Speech Median Framing: </b>" + ele.median;
    d3.select("#tooltip-text").html(tooltipText);

    const tooltipTextEle = d3.select("#tooltip-text")._groups[0][0];

    d3.select("#tooltip-container")
        .style("left", () => {
            const tooltipHalfWidth = tooltipTextEle.offsetWidth / 2,
                windowsWidth = width + margin.right;

            if (left < tooltipHalfWidth) return 10;
            else if ((left + tooltipHalfWidth) > windowsWidth) return width - tooltipHalfWidth * 2;
            else return left - tooltipHalfWidth;
        });

    if (top < tooltipTextEle.offsetHeight) d3.select("#tooltip-container").style("top", top + 55);
}

function MouseoutFace() {

    d3.select("#face-" + mouseoveredFaceId)
        .style("width", faceImageWidth)
        .style("height", faceImageWidth)
        .style("left", mouseoveredLeft)
        .style("top", mouseoveredTop);

    d3.select("#circle-" + mouseoveredFaceId)
        .attr("r", faceBubbleRadius)
        .attr("stroke-width", 0)
        .attr("fill-opacity", 0);

    d3.select("#tooltip-container").style("display", "none");

    mouseoveredEle.mouseover = false;
}

function ClickFace(ele) {
    viewMoving = true;
    if (viewMoved) {
        ResetMove();
        setTimeout(() => { viewMoved = !viewMoved; }, transitDuration);
        setTimeout(() => { viewMoving = false; }, transitDuration * 1.2);
    }
    else {
        MoveToFace(ele);
        setTimeout(() => { ShowSnippets(ele); }, transitDuration);
        setTimeout(() => { viewMoving = false; }, transitDuration * 1.2);
        viewMoved = !viewMoved;
    }
}

function MoveToFace(ele) {

    const newxScale = d3.scaleLinear()
        .domain([ele.cx - width / 2, ele.cx + width / 2])
        .range([0, width]);

    const newyScale = d3.scaleLinear()
        .domain([ele.cy - height / 2, ele.cy + height / 2])
        .range([0, height]);

    faceBubble.each(item => {

        item.ncx = newxScale(item.cx);
        item.ncy = newyScale(item.cy);

        const startLeft = item.mouseover ? item.cx + margin.left - faceOffset - biggerFaceOffset : item.cx + margin.left - faceOffset;
        const endLeft = item.mouseover ? item.ncx + margin.left - faceOffset - biggerFaceOffset : item.ncx + margin.left - faceOffset;

        const startTop = item.mouseover ? item.cy + margin.top - faceOffset - biggerFaceOffset : item.cy + margin.top - faceOffset;
        const endTop = item.mouseover ? item.ncy + margin.top - faceOffset - biggerFaceOffset : item.ncy + margin.top - faceOffset;

        d3.select("#face-" + faceIdDict[item.speaker])
            .transition().duration(transitDuration)
            .styleTween("left", () => { return d3.interpolateString(startLeft, endLeft); })
            .styleTween("top", () => { return d3.interpolateString(startTop, endTop); })
            .transition().duration(0).delay(transitDuration / 10)
            .style("opacity", item.speaker == ele.speaker ? 1 : .03)
            .style("display", endLeft > (width + margin.left * 2) || endTop > (height + margin.top) ? "none" : "block");

        d3.select("#circle-" + faceIdDict[item.speaker])
            .transition().duration(transitDuration)
            .attr("cx", item.ncx)
            .attr("cy", item.ncy);

        d3.selectAll(".donut-" + faceIdDict[item.speaker])
            .transition().duration(transitDuration)
            .attr("transform", "translate(" + item.ncx + "," + item.ncy + ")")
            .transition().duration(0).delay(transitDuration / 10)
            .style("opacity", d => {
                if (item.speaker != ele.speaker) return d.data.hasSpeech == 0 ? .015 : .03;
                else return d.data.hasSpeech == 0 ? clockOpacity : bandOpacity;
            });
    });

    d3.select("#tooltip-container")
        .transition().duration(transitDuration)
        .styleTween("left", function () {
            const startLeft = this.style.left;
            const endLeft = ele.ncx + margin.left - this.offsetWidth / 2;
            return d3.interpolateString(startLeft, endLeft);
        })
        .styleTween("top", function () {
            const startTop = this.style.top;
            const endTop = ele.ncy - 90;
            return d3.interpolateString(startTop, endTop);
        });
}

function ResetMove() {

    d3.selectAll(".snippets").remove();
    d3.selectAll(".snippetTabs").remove();
    prevSnippet = null;
    MouseoutFace();

    faceBubble.each(item => {

        d3.select("#face-" + faceIdDict[item.speaker])
            .style("display", "block")
            .style("opacity", 1)
            .transition().duration(transitDuration)
            .styleTween("left", () => {
                const startLeft = item.ncx + margin.left - faceOffset;
                const endLeft = item.cx + margin.left - faceOffset;
                return d3.interpolateString(startLeft, endLeft);
            })
            .styleTween("top", () => {
                const startTop = item.ncy + margin.top - faceOffset;
                const endTop = item.cy + margin.top - faceOffset;
                return d3.interpolateString(startTop, endTop);
            });

        d3.selectAll("#circle-" + faceIdDict[item.speaker])
            .transition().duration(transitDuration)
            .attr("cx", item.cx)
            .attr("cy", item.cy);

        d3.selectAll(".donut-" + faceIdDict[item.speaker])
            .style("opacity", d => d.data.hasSpeech == 0 ? clockOpacity : bandOpacity)
            .transition().duration(transitDuration)
            .attr("transform", "translate(" + item.cx + "," + item.cy + ")");
    });
}

svg.on("click", function (event) {
    if (viewMoved && event.detail == 1 && !viewMoving) {
        viewMoving = true;
        ResetMove();
        setTimeout(() => { viewMoved = !viewMoved; }, transitDuration);
        setTimeout(() => { viewMoving = false; }, transitDuration * 1.2);
    }
});

const snippetPositions = CalculatePositions(width / 3, height / 2.25, snippetStacksNum),
    tabPositions = CalculatePositions(width / 4.5, height / 3.75, dates.length - 1 + faceBubbleGap);
function CalculatePositions(ellipseWidth, ellipseHeight, segmentsNum) {

    const positions = [];

    const centerX = width / 2;
    const centerY = height / 2;
    const angleIncrement = (2 * Math.PI) / segmentsNum;

    let angle = 0;
    let x = centerX;
    let y = centerY - ellipseHeight;
    for (let i = 0; i < segmentsNum; i++) {
        positions.push({ x, y });

        angle += angleIncrement;
        x = centerX + ellipseWidth * Math.sin(angle);
        y = centerY - ellipseHeight * Math.cos(angle);
    }

    return positions;
}
function ShowSnippets(ele) {

    const originalSnippet = document.getElementById("snippet-container"),
        originalTab = document.getElementById("snippet-tab");

    let counter = 0,
        stackDict = {};
    const speeches = ele.speeches;
    Object.keys(speeches).sort().forEach(key => {

        const index = dates.indexOf(key) - 1 + faceBubbleGap,
            stackId = Math.floor(index / snippetStacksNum),
            snippetY = snippetPositions[stackId].y - margin.top / 2 + index % snippetStacksNum,
            snippetColour = d3.color(affiliationColours[ele.affiliation]).darker(ele.darkness);
        let snippetX = stackId <= 6 ? snippetPositions[stackId].x + margin.left + index % snippetStacksNum : snippetPositions[stackId].x - snippetWidth + margin.left + index % snippetStacksNum;
        if (stackId == 0 || stackId == 6) snippetX -= snippetWidth / 2;
        else if (stackId == 1 || stackId == 5) snippetX -= snippetWidth / 3;
        else if (stackId == 7 || stackId == 11) snippetX += snippetWidth / 3;

        const cloneSnippet = originalSnippet.cloneNode(true),
            cloneTab = originalTab.cloneNode(true);

        d3.select(cloneSnippet)
            .attr("class", "snippets")
            .attr("id", "snippet-" + ++counter)
            .style("position", "absolute")
            .style("left", snippetX)
            .style("top", snippetY)
            .style("width", snippetWidth)
            .style("height", snippetHeight)
            .style("overflow-y", "auto")
            .style("padding", "10px 10px 10px 10px")
            .style("margin", "0px 10px 10px 0px")
            .style("border", "1.5px solid " + snippetColour)
            .style("border-radius", "8px")
            .style("box-shadow", "0px 3px 9px rgba(0, 0, 0, .15)")
            .style("background", "white")
            .style("display", "block")
            .on("click", function () {
                const newSnippet = prevSnippet == null ? true : prevSnippet.id != cloneSnippet.id;
                if (prevSnippet != null) PutBackSnippet(stackDict, false);
                if (newSnippet) CallOutSnippet(cloneSnippet);
            })
            .style("opacity", 0)
            .transition().delay(counter * 30)
            .style("opacity", 1);

        const snippetText = "<b>Date:</b> " + speeches[key].formatedDate.toLocaleDateString("en-au", { year: "numeric", month: "short", day: "numeric" }) + "<br/>" +
            "<b>Speech Snippet Framing: </b>" + speeches[key].diff.toFixed(3) + "<br/>" +
            "<b>Speech Snippet: </b>" + "<br/>" + speeches[key].text;
        d3.select(cloneSnippet).selectChildren().html(snippetText);
        cloneSnippet.__data__ = { left: snippetX, top: snippetY, colour: snippetColour, id: faceIdDict[ele.speaker], index: dates.indexOf(key) };

        d3.select(cloneTab)
            .attr("class", "snippetTabs")
            .attr("id", "snippetTab-" + faceIdDict[ele.speaker] + "-" + dates.indexOf(key))
            .style("position", "absolute")
            .style("left", tabPositions[dates.indexOf(key)].x + margin.left)
            .style("top", tabPositions[dates.indexOf(key)].y + margin.top)
            .style("width", 12)
            .style("height", 12)
            .style("border-style", "solid")
            .style("border-color", "black")
            .style("border-width", "0.5px")
            .style("background", diffColourScale(speeches[key].diff))
            .on("mouseover", function () {
                d3.select(this).moveToFront();
                HighlightSnippet(stackDict, cloneSnippet);
            })
            .on("mouseout", function () {
                DehighlightSnippet(stackDict);
            })
            .on("click", function () {
                const newSnippet = prevSnippet == null ? true : prevSnippet.id != cloneSnippet.id;
                if (prevSnippet != null) PutBackSnippet(stackDict, true);
                if (newSnippet) CallOutSnippet(cloneSnippet);
            })
            .style("opacity", 0)
            .transition().duration(0).delay(counter * 30)
            .style("opacity", 1);

        originalSnippet.parentNode.appendChild(cloneSnippet);
        originalTab.parentNode.appendChild(cloneTab);

        if (stackDict[stackId] === undefined) stackDict[stackId] = [];
        stackDict[stackId].push(cloneSnippet);
    });
}

function HighlightSnippet(stackDict, snippet) {

    HighlightMinor(snippet);

    Object.keys(stackDict).forEach(key => {
        stackDict[key].forEach(item => {
            if (item == snippet) return;
            let colour = item.__data__.colour;
            colour.opacity = .15;
            d3.select(item)
                .style("color", "lightgrey")
                .style("border", "1.5px solid " + colour);
            colour.opacity = 1;
        });
    });

    d3.select(snippet).moveToFront();
}

function DehighlightSnippet(stackDict) {

    DehighlightMinor(stackDict);

    d3.selectAll(".snippets")
        .style("color", "black")
        .style("border", d => "1.5px solid " + d.colour);

    if (prevSnippet != null) HighlightMinor(prevSnippet);
}

function HighlightMinor(snippet) {

    d3.selectAll(".snippetTabs").style("opacity", .25);
    d3.selectAll(".donut-" + snippet.__data__.id).style("opacity", clockOpacity);

    d3.select("#snippetTab-" + snippet.__data__.id + "-" + snippet.__data__.index)
        .style("border-width", "2px")
        .style("opacity", 1);
    d3.select("#donut-" + snippet.__data__.id + "-" + snippet.__data__.index)
        .style("opacity", bandOpacity);
}

function DehighlightMinor(stackDict) {
    d3.selectAll(".snippetTabs")
        .style("border-width", "0.5px")
        .style("opacity", 1);
    Object.keys(stackDict).forEach(key => {
        stackDict[key].forEach(snippet => {
            d3.select("#donut-" + snippet.__data__.id + "-" + snippet.__data__.index).style("opacity", bandOpacity);
        });
    });
}

let prevSnippet = null;
function CallOutSnippet(snippet, tabCallout) {

    prevSnippet = snippet;

    d3.select(snippet)
        .moveToFront()
        .style("width", callOutSnippetWidth)
        .style("max-height", height / 2)
        .transition().duration(transitDuration / 5)
        .styleTween("height", () => {
            const newHeight = d3.select(snippet).selectChildren()._groups[0][0].offsetHeight;
            return d3.interpolateString(snippetHeight, newHeight);
        })
        .styleTween("left", () => {
            const startLeft = snippet.__data__.left;
            const endLeft = width / 2 - callOutSnippetWidth / 2 + margin.left;
            return d3.interpolateString(startLeft, endLeft);
        })
        .styleTween("top", () => {
            const startTop = snippet.__data__.top;
            const endTop = height / 2 - snippetHeight;
            return d3.interpolateString(startTop, endTop);
        });

    if (!tabCallout) HighlightMinor(snippet);
}

function PutBackSnippet(stackDict) {

    const startHeight = prevSnippet.style.height,
        startLeft = prevSnippet.style.left,
        endLeft = prevSnippet.__data__.left,
        startTop = prevSnippet.style.top,
        endTop = prevSnippet.__data__.top;

    d3.select(prevSnippet)
        .style("width", snippetWidth)
        .transition().duration(transitDuration / 5)
        .styleTween("height", () => {
            return d3.interpolateString(startHeight, snippetHeight);
        })
        .styleTween("left", () => {
            return d3.interpolateString(startLeft, endLeft);
        })
        .styleTween("top", () => {
            return d3.interpolateString(startTop, endTop);
        });

    prevSnippet = null;

    DehighlightMinor(stackDict);
}