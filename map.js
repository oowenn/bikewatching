// Set your Mapbox access token here
mapboxgl.accessToken = 'pk.eyJ1IjoiYTRzaGkiLCJhIjoiY203YjVtYXhmMGIwdDJrcHc1Ym5kbHpqciJ9.A3l23yCQealGw-VZ9U-Z7w';

// Initialize the map
const map = new mapboxgl.Map({
    container: 'map', // ID of the div where the map will render
    style: 'mapbox://styles/mapbox/streets-v12', // Map style
    center: [-71.09415, 42.36027], // [longitude, latitude]
    zoom: 12, // Initial zoom level
    minZoom: 5, // Minimum allowed zoom
    maxZoom: 18 // Maximum allowed zoom
});

let line_styles = {
    'line-color': '#32D400',  // A bright green using hex code
    'line-width': 5,          // Thicker lines
    'line-opacity': 0.6       // Slightly less transparent
};

let stations;
const svg = d3.select('#map').select('svg');
let circles;
let trips;
let filteredTrips = [];
let filteredArrivals = new Map();
let filteredDepartures = new Map();
let filteredStations = [];
let stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);

map.on('load', () => { 
    map.addSource('boston_route', {
        type: 'geojson',
        data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson?...'
    });
    map.addLayer({
        id: 'bike-lanes-boston',
        type: 'line',
        source: 'boston_route',
        paint: line_styles
    });
    
    map.addSource('cambridge_route', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson'
    });
    map.addLayer({
        id: 'bike-lanes-cambridge',
        type: 'line',
        source: 'cambridge_route',
        paint: line_styles
    });
    
    // Load the nested JSON file
    const jsonurl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
    const tripsurl = "https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv";
    
    d3.json(jsonurl).then(jsonData => {
        stations = jsonData.data.stations;
        
        // Append circles to the SVG for each station
        circles = svg.selectAll('circle')
        .data(stations)
        .enter()
        .append('circle')
        .attr('r', 5)               // Radius of the circle
        .attr('fill', 'steelblue')  // Circle fill color
        .attr('stroke', 'white')    // Circle border color
        .attr('stroke-width', 1)    // Circle border thickness
        .attr('opacity', 0.8)      // Circle opacity
        ;
        
        // Initial position update when map loads
        updatePositions();
    }).then(
        d3.csv(tripsurl).then(data => {
            trips = data;
            
            for (let trip of trips) {
                trip.started_at = new Date(trip.started_at);
                trip.ended_at = new Date(trip.ended_at);
            }
            filterTripsbyTime();
    })).catch(error => {
        console.error("Error loading the traffic data:", error);
    });            

                


    // d3.json(jsonurl).then(jsonData => {
    //     stations = jsonData.data.stations;
        
    //     // Append circles to the SVG for each station
    //     circles = svg.selectAll('circle')
    //     .data(stations)
    //     .enter()
    //     .append('circle')
    //     .attr('r', 5)               // Radius of the circle
    //     .attr('fill', 'steelblue')  // Circle fill color
    //     .attr('stroke', 'white')    // Circle border color
    //     .attr('stroke-width', 1)    // Circle border thickness
    //     .attr('opacity', 0.8)      // Circle opacity
    //     ;
        
    //     // Initial position update when map loads
    //     updatePositions();
    // }).catch(error => {
    //     console.error('Error loading JSON:', error);  // Handle errors if JSON loading fails
    // });

    // d3.csv(tripsurl).then(data => {
    //     trips = data;
        
    //     for (let trip of trips) {
    //         trip.started_at = new Date(trip.started_at);
    //         trip.ended_at = new Date(trip.ended_at);
    //     }
    //     filterTripsbyTime();
                
    //     }).catch(error => {
    //         console.error("Error loading the traffic data:", error);
    //     });            
});


function getCoords(station) {
    const point = new mapboxgl.LngLat(+station.lon, +station.lat);  // Convert lon/lat to Mapbox LngLat
    const { x, y } = map.project(point);  // Project to pixel coordinates
    return { cx: x, cy: y };  // Return as object for use in SVG attributes
}



// Function to update circle positions when the map moves/zooms
function updatePositions() {
    circles
    .attr('cx', d => getCoords(d).cx)  // Set the x-position using projected coordinates
    .attr('cy', d => getCoords(d).cy); // Set the y-position using projected coordinates
}

// Reposition markers on map interactions
map.on('move', updatePositions);     // Update during map movement
map.on('zoom', updatePositions);     // Update during zooming
map.on('resize', updatePositions);   // Update on window resize
map.on('moveend', updatePositions);  // Final adjustment after movement ends


let timeFilter = -1;

const timeSlider = document.getElementById('time-slider');
const selectedTime = document.getElementById('selected-time');
const anyTimeLabel = document.getElementById('any-time');

function formatTime(minutes) {
    const date = new Date(0, 0, 0, 0, minutes);  // Set hours & minutes
    return date.toLocaleString('en-US', { timeStyle: 'short' }); // Format as HH:MM AM/PM
}

function updateTimeDisplay() {
    timeFilter = Number(timeSlider.value);  // Get slider value
  
    if (timeFilter === -1) {
      selectedTime.textContent = '';  // Clear time display
      anyTimeLabel.style.display = 'block';  // Show "(any time)"
    } else {
      selectedTime.textContent = formatTime(timeFilter);  // Display formatted time
      anyTimeLabel.style.display = 'none';  // Hide "(any time)"
    }
  
    // Trigger filtering logic which will be implemented in the next step

}

updateTimeDisplay();
timeSlider.addEventListener('input', updateTimeDisplay);
timeSlider.addEventListener('input', filterTripsbyTime);


function minutesSinceMidnight(date) {
    return date.getHours() * 60 + date.getMinutes();
}

function filterTripsbyTime() {
    filteredTrips = timeFilter === -1
        ? trips
        : trips.filter((trip) => {
            const startedMinutes = minutesSinceMidnight(trip.started_at);
            const endedMinutes = minutesSinceMidnight(trip.ended_at);
            return (
              Math.abs(startedMinutes - timeFilter) <= 60 ||
              Math.abs(endedMinutes - timeFilter) <= 60
            );
        });

    // we need to update the station data here explained in the next couple paragraphs
    filteredDepartures = d3.rollup(
        filteredTrips,
        (v) => v.length,
        (d) => d.start_station_id,
    );
            
    filteredArrivals = d3.rollup(
        filteredTrips,
        (v) => v.length, // count the number of trips
        (d) => d.end_station_id // group by end station ID
    );

                
    filteredStations = stations.map((station) => {
        station = { ...station }; // Copy the station object
        let id = station.short_name;
        station.arrivals = filteredArrivals.get(id) ?? 0;
        station.departures = filteredDepartures.get(id) ?? 0;
        station.totalTraffic = station.arrivals + station.departures;
        return station;
    });
    const radiusScale = d3
        .scaleSqrt()
        .domain([0, d3.max(filteredStations, (d) => d.totalTraffic)])
        .range(timeFilter === -1 ? [0, 25] : [3, 25]);
            
    circles
        .data(filteredStations)
        .attr('r', (d) => radiusScale(d.totalTraffic))
        .style("--departure-ratio", d => stationFlow(d.departures / d.totalTraffic));

    circles
        .each(function(d) {
            d3.select(this)
            .append('title')
            .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`)
        });



}

