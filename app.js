import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { plume } from "./plume.js"
import { stackedProb } from "./stackedProb.js"

// Set up parameter information
const getParamInfo = (param) => {
    const params = {
        temp: {
            name: "T2m",
            units: "&#8451",
            colours: [d3.interpolateBlues(0.8), d3.interpolateBlues(0.5), d3.interpolateBlues(0.2)],
            binSize: 1.0,
            fixedBinSize: false,
            type: "plume"
        },
        windspeed: {
            name: "S10m",
            units: "m/s",
            colours: [d3.interpolatePurples(0.8), d3.interpolatePurples(0.5), d3.interpolatePurples(0.2)],
            binSize: 1.0,
            fixedBinSize: false,
            type: "plume"
        },
        winddir: {
            name: "D10m",
            units: "&deg",
            colours: [d3.interpolateOranges(0.8), d3.interpolateOranges(0.5), d3.interpolateOranges(0.2)],
            binSize: 10.0,
            fixedBinSize: false,
            type: "plume"
        },
        precip: {
            name: "Pcp",
            units: "mm",
            binSize: 1.0,
            fixedBinSize: true,
            type: "stackedProb"
        },
        cloud: {
            name: "CAF",
            units: "%",
            colours: [d3.interpolateGreys(0.8), d3.interpolateGreys(0.5), d3.interpolateGreys(0.2)],
            binSize: 10.0,
            fixedBinSize: true,
            type: "plume"
        },
        hum: {
            name: "RH2m",
            units: "%",
            colours: [d3.interpolatePuBuGn(0.8), d3.interpolatePuBuGn(0.5), d3.interpolatePuBuGn(0.2)],
            binSize: 5.0,
            fixedBinSize: false,
            type: "plume"
        }
    }
    return(params[param])
}



// async function to load data

const getData = async () => {
    let data = await d3.json("./data/meps_major_cities_2022081500_1600.json")
    // Set any negative precipitation values to 0
    data = data.map(d => ("Pcp" in d) ? d.Pcp < 0 ? ({...d, Pcp: 0.0}) : d : d)
    return data
}


// Set up chart dimensions

const width = 800;
const height = 100;
const margin = {
    top: 15,
    right: 40,
    bottom: 20,
    left: 40
};

// Function to set up a plume plot
const plumeChart = (divID, data, param, thresh) => {

    let svg = d3.select("#" + param);

    if (svg.empty()) {
        svg = d3.create("svg")
            .attr("id", param)
            //.attr("viewBox", [0, 0, width, height])
            .attr("width", width)
            .attr("height", height)
            .attr("font-family", "sans-serif");
    }

    const currentParam = getParamInfo(param);

    new plume(svg)
        .data(data)
        .size(width, height)
        .paramKey(currentParam.name)
        .paramUnit(currentParam.units)
        .margins(margin.top, margin.right, margin.bottom, margin.left)
        .colours(...currentParam.colours)
        .bg("#FFF")
        .textColour("#999")
        .threshold(thresh)
        .binSize(currentParam.binSize)
        .forceBinSize(currentParam.fixedBinSize)
        .render()

    d3.select("#" + divID).append(() => svg.node())
 
}

// Function to set up a stacked probability plot
const stackChart = (divID, data, param, thresh) => {

    let svg = d3.select("#" + param);

    if (svg.empty()) {
        svg = d3.create("svg")
            .attr("id", param)
            //.attr("viewBox", [0, 0, width, height])
            .attr("width", width)
            .attr("height", height)
            .attr("font-family", "sans-serif");
    }

    const currentParam = getParamInfo(param);

    new stackedProb(svg)
        .data(data)
        .size(width, height)
        .paramKey(currentParam.name)
        .paramUnit(currentParam.units)
        .margins(margin.top, margin.right, margin.bottom, margin.left)
        //.colours(...currentParam.colours)
        .bg("#FFF")
        .textColour("#999")
        .threshold(thresh)
        .binSize(currentParam.binSize)
        .forceBinSize(currentParam.fixedBinSize)
        .render()

    d3.select("#" + divID).append(() => svg.node())
 
}


// Function to refersh charts and sliders (creates on first call)
const refreshApp = async (dataIn) => {
    const params = ["temp", "windspeed", "hum", "winddir", "cloud", "precip"]
    const data = await dataIn;

    // station selector
    const dropdown = document.createElement("select");
    dropdown.setAttribute("id", "choose-station")
    dropdown.addEventListener("change", (event) => {
        for (const prm of params) {
            updateThreshSlider(data, prm);
            drawChart(data, prm);
        }
    });
    const stations = [...new Set(data.map(d => d.name))].sort();
    for (let i = 0; i < stations.length; i++) {
        let opt = document.createElement("option");
        opt.text = stations[i];
        opt.value = stations[i];
        dropdown.options.add(opt);
    }
    dropdown.selectedIndex = 0;
    const dropdownLabel = document.createElement("label");
    dropdownLabel.setAttribute("for", "choose-station")
    dropdownLabel.innerHTML = "<strong>Location: </strong>";
    const locContainer = document.getElementById("location-dropdown");
    locContainer.appendChild(dropdownLabel);
    locContainer.appendChild(dropdown);

    // Threshold Sliders
    for (const prm of params) {
        makeThreshSlider(data, prm);
    }

    // Draw charts for the first time
    for (const prm of params) {
        drawChart(data, prm);
    }
}

const data = getData();

refreshApp(data);

const filterToLocation = data => {
    const loc = document.getElementById("choose-station").value
    console.log(data)
    return data.filter(d => d.name === loc)
}

const makeThreshSlider = (data, param) => {
    //const data = filterToLocation(dataIn);
    const currentParam = getParamInfo(param)
    const threshRange = d3.extent(data, d => d[currentParam.name]);
    const n = currentParam.binSize;
    const slider = document.createElement("input");
    slider.setAttribute("type", "range");
    slider.setAttribute("id", param + "-threshold");
    slider.setAttribute("min", n * Math.floor(threshRange[0] / n));
    slider.setAttribute("max", n * Math.ceil(threshRange[1] / n));
    slider.setAttribute("value", n * Math.floor(threshRange[0] / n));
    slider.setAttribute("step", n);
    slider.addEventListener("input", event => drawChart(data, param));
    const sliderLabel = document.createElement("label");
    sliderLabel.setAttribute("for", param + "-threshold");
    sliderLabel.innerHTML = "<strong>   Threshold: </strong>";
    const threshContainer = document.getElementById("thresholds-" + param);
    threshContainer.appendChild(sliderLabel);
    threshContainer.appendChild(slider);   
}

const updateThreshSlider = (dataIn, param) => {
    const data = filterToLocation(dataIn);
    const currentParam = getParamInfo(param)
    const threshRange = d3.extent(data, d => d[currentParam.name]);
    const n = currentParam.binSize;
    const slider = document.getElementById(param + "-threshold")
    slider.setAttribute("min", n * Math.floor(threshRange[0] / n));
    slider.setAttribute("max", n * Math.ceil(threshRange[1] / n));
    slider.setAttribute("value", n * Math.floor(threshRange[0] / n));
}

const drawChart = (dataIn, param) => {

    const data = filterToLocation(dataIn);

    // Get threshold from slider
    const slider = document.getElementById(param + "-threshold")
    const thresh = slider.value;
    const currentParam = getParamInfo(param)

    // Call the chart drawing function
    currentParam.type === "plume"
        ? plumeChart(param + "Container", data, param, thresh)
        : currentParam.type === "stackedProb"
            ? stackChart(param + "Container", data, param, thresh)
            : plumeChart(param + "Container", data, param, thresh)
}

