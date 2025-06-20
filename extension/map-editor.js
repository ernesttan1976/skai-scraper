// GPS Jamming Map Editor with debugging
class GPSJammingMapEditor {
  constructor() {
    this.map = null;
    this.hexagons = new Map();
    this.selectedColor = "transparent";
    this.h3Resolution = 3; // Changed from 8 to 3 for larger hexagons starting with 83

    this.colors = {
      transparent: {
        color: "#000000",
        fillColor: "transparent",
        fillOpacity: 0.1,
      },
      yellow: { color: "#ffff00", fillColor: "#ffff00", fillOpacity: 0.6 },
      orange: { color: "#ff8000", fillColor: "#ff8000", fillOpacity: 0.6 },
      red: { color: "#ff0000", fillColor: "#ff0000", fillOpacity: 0.6 },
    };

    this.debugLog("GPSJammingMapEditor constructor started");
    this.init();
  }

  debugLog(message) {
    console.log("[MapEditor]", message);
    const debugElement = document.getElementById("debugInfo");
    if (debugElement) {
      debugElement.textContent = message;
    }
  }

  init() {
    this.debugLog("Initializing map editor...");

    // Check if Leaflet is available
    if (typeof L === "undefined") {
      this.debugLog("ERROR: Leaflet not loaded!");
      return;
    }

    this.debugLog("Leaflet available, initializing components...");

    setTimeout(() => {
      this.initMap();
      this.initControls();
      this.initH3();
    }, 100);
  }

  initMap() {
    try {
      this.debugLog("Creating Leaflet map...");

      // Initialize the map
      this.map = L.map("map", {
        center: [1.3521, 103.8198], // Singapore
        zoom: 10,
        preferCanvas: true,
      });

      this.debugLog("Map created, adding tiles...");

      // Add OpenStreetMap tiles
      const tileLayer = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          attribution: "© OpenStreetMap contributors",
          maxZoom: 18,
          crossOrigin: true,
        }
      );

      tileLayer.addTo(this.map);

      tileLayer.on("load", () => {
        this.debugLog("Map tiles loaded successfully");
      });

      tileLayer.on("tileerror", (e) => {
        this.debugLog("Tile load error: " + e.error);
      });

      // Add click handler for hexagon creation/editing
      this.map.on("click", (e) => {
        this.handleMapClick(e);
      });

      this.debugLog("Map initialization complete");

      // Force map resize after a short delay
      setTimeout(() => {
        this.map.invalidateSize();
        this.debugLog("Map size invalidated");
      }, 250);
    } catch (error) {
      this.debugLog("ERROR initializing map: " + error.message);
      console.error("Map initialization error:", error);
    }
  }

  initControls() {
    try {
      this.debugLog("Initializing controls...");

      // Color selector
      document.querySelectorAll(".color-option").forEach((option) => {
        option.addEventListener("click", (e) => {
          document
            .querySelectorAll(".color-option")
            .forEach((opt) => opt.classList.remove("active"));
          option.classList.add("active");
          this.selectedColor = option.getAttribute("data-color");
          this.updateMapStatus(`Selected color: ${this.selectedColor}`);
        });
      });

      // File input for KMZ loading
      const fileInput = document.getElementById("kmzFileInput");
      if (fileInput) {
        fileInput.addEventListener("change", (e) => {
          this.loadKMZFile(e.target.files[0]);
        });
      }

      // Button handlers
      const loadBtn = document.getElementById("loadKmzBtn");
      if (loadBtn) {
        loadBtn.addEventListener("click", () => {
          document.getElementById("kmzFileInput").click();
        });
      }

      const saveBtn = document.getElementById("saveEditedKmzBtn");
      if (saveBtn) {
        saveBtn.addEventListener("click", () => {
          this.saveEditedKMZ();
        });
      }

      const resetBtn = document.getElementById("resetMapBtn");
      if (resetBtn) {
        resetBtn.addEventListener("click", () => {
          this.resetMap();
        });
      }

      const resolutionSelect = document.getElementById("resolutionSelect");
      if (resolutionSelect) {
        resolutionSelect.addEventListener("change", (e) => {
          this.h3Resolution = parseInt(e.target.value);
          this.updateMapStatus(`H3 Resolution set to: ${this.h3Resolution}`);
        });
      }

      this.debugLog("Controls initialized");
    } catch (error) {
      this.debugLog("ERROR initializing controls: " + error.message);
    }
  }

  initH3() {
    try {
      if (typeof window !== "undefined" && window.h3) {
        this.h3 = window.h3;
        this.debugLog("H3 library loaded from window.h3");
      } else if (typeof h3 !== "undefined") {
        this.h3 = h3;
        this.debugLog("H3 library loaded globally");
      } else {
        this.debugLog("ERROR: H3 library not available");
        this.updateMapStatus("H3 library not available");
        return;
      }

      // Test H3
      try {
        const testCell = this.h3.latLngToCell(1.3521, 103.8198, 8);
        this.debugLog("H3 test successful: " + testCell);
        this.updateMapStatus("Ready - Click on map to add hexagons");
      } catch (h3Error) {
        this.debugLog("H3 test failed: " + h3Error.message);
      }
    } catch (error) {
      this.debugLog("ERROR initializing H3: " + error.message);
    }
  }

  handleMapClick(e) {
    if (!this.h3) {
      this.debugLog("H3 library not available for map click");
      return;
    }

    const { lat, lng } = e.latlng;

    try {
      // Get H3 index for clicked location
      const h3Index = this.h3.latLngToCell(lat, lng, this.h3Resolution);

      // Check if hexagon already exists
      if (this.hexagons.has(h3Index)) {
        this.updateHexagon(h3Index, this.selectedColor);
        this.debugLog(`Updated hexagon ${h3Index} to ${this.selectedColor}`);
      } else {
        this.createHexagon(h3Index, this.selectedColor);
        this.debugLog(`Created ${this.selectedColor} hexagon ${h3Index}`);
      }

      this.updateMapStatus(
        `${this.selectedColor} hexagon at H3: ${h3Index.substring(0, 10)}...`
      );
    } catch (error) {
      this.debugLog("Error in map click: " + error.message);
      this.updateMapStatus("Error creating hexagon");
    }
  }

  extractPlacemarkAttributes(placemark) {
    const attributes = {};

    // Extract all attributes from the placemark
    if (placemark.id) attributes.id = placemark.id;

    // Extract polygon and ring IDs if they exist
    const polygon = placemark.querySelector("Polygon");
    if (polygon && polygon.id) attributes.polygonId = polygon.id;

    const ring = placemark.querySelector("LinearRing");
    if (ring && ring.id) attributes.ringId = ring.id;

    // Extract any extended data
    const extendedData = placemark.querySelector("ExtendedData");
    if (extendedData) {
      attributes.extendedData = new XMLSerializer().serializeToString(
        extendedData
      );
    }

    // Extract any other custom elements
    for (const child of placemark.children) {
      if (
        ![
          "name",
          "description",
          "styleUrl",
          "Polygon",
          "Point",
          "LineString",
        ].includes(child.tagName)
      ) {
        attributes[child.tagName] =
          child.textContent || new XMLSerializer().serializeToString(child);
      }
    }

    return attributes;
  }

  createHexagon(h3Index, color, originalData = {}) {
    try {
      // Get hexagon boundary
      const boundary = this.h3.cellToBoundary(h3Index);

      // Convert to Leaflet LatLng format with longitude normalization
      const latLngs = this.normalizeBoundaryLongitudes(boundary);

      // Create polygon
      const polygon = L.polygon(latLngs, {
        ...this.colors[color],
        weight: 2,
      });

      // Add to map
      polygon.addTo(this.map);

      // Store hexagon data with original KML information
      this.hexagons.set(h3Index, {
        polygon: polygon,
        color: color,
        h3Index: h3Index,
        originalData: originalData, // Preserve all original KML data
      });

      // Add click handler to the polygon
      polygon.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        this.updateHexagon(h3Index, this.selectedColor);
      });
    } catch (error) {
      this.debugLog("Error creating hexagon: " + error.message);
    }
  }

  // Helper method to normalize longitude coordinates
  normalizeBoundaryLongitudes(boundary) {
    const latLngs = boundary.map(([lat, lng]) => [lat, lng]);

    if (latLngs.length < 2) return latLngs;

    // Check if we're crossing the 180° meridian
    const longitudes = latLngs.map((coord) => coord[1]);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);

    // If the difference is greater than 180°, we're likely crossing the dateline
    if (maxLng - minLng > 180) {
      // Normalize all negative longitudes to positive (0-360 range)
      return latLngs.map(([lat, lng]) => [lat, lng < 0 ? lng + 360 : lng]);
    }

    return latLngs;
  }

  updateHexagon(h3Index, newColor) {
    const hexagon = this.hexagons.get(h3Index);
    if (!hexagon) return;

    // Update polygon style
    hexagon.polygon.setStyle(this.colors[newColor]);

    // Update stored color
    hexagon.color = newColor;

    // Note: Don't remove transparent hexagons - keep them in data
    // They will be saved with the transparent style when exporting
  }

  async loadKMZFile(file) {
    if (!file) return;

    try {
      console.log(
        "Loading file:",
        file.name,
        "Size:",
        file.size,
        "Type:",
        file.type
      );
      this.updateMapStatus("Loading KMZ file...");

      const arrayBuffer = await file.arrayBuffer();
      console.log("File loaded, size:", arrayBuffer.byteLength);

      const zip = new JSZip();
      const contents = await zip.loadAsync(arrayBuffer);
      console.log("ZIP contents:", Object.keys(contents.files));

      // Find KML file
      let kmlContent = null;
      let kmlFilename = null;

      for (const filename in contents.files) {
        console.log("Checking file:", filename);
        if (filename.endsWith(".kml")) {
          kmlFilename = filename;
          kmlContent = await contents.files[filename].async("text");
          console.log(
            "Found KML file:",
            filename,
            "Content length:",
            kmlContent.length
          );
          break;
        }
      }

      if (!kmlContent) {
        throw new Error(
          "No KML file found in KMZ. Available files: " +
            Object.keys(contents.files).join(", ")
        );
      }

      this.parseAndRenderKML(kmlContent);
      this.updateMapStatus(`KMZ loaded: ${kmlFilename}`);
    } catch (error) {
      console.error("Error loading KMZ:", error);
      this.updateMapStatus("Error: " + error.message);
    }
  }

  parseAndRenderKML(kmlContent) {
    try {
      console.log("Raw KML content:", kmlContent.substring(0, 500));

      const parser = new DOMParser();
      const doc = parser.parseFromString(kmlContent, "text/xml");
      const parseError = doc.querySelector("parsererror");
      if (parseError) {
        throw new Error("XML parsing error: " + parseError.textContent);
      }
      const placemarks = doc.querySelectorAll("Placemark");
      console.log("Found placemarks:", placemarks.length);
      if (placemarks.length === 0) {
        console.log("No placemarks found. KML structure:");
        console.log(new XMLSerializer().serializeToString(doc));
      }

      let bounds = null;
      let hexagonCount = 0;

      placemarks.forEach((placemark) => {
        try {
          const description =
            placemark.querySelector("description")?.textContent || "";
          console.log("Description content:", description);

          // Extract H3 index from description
          let h3Index = null;
          const patterns = [
            /H3 Index:\s*([a-f0-9]+)/i,
            /h3_index[:\s]*([a-f0-9]+)/i,
            /([a-f0-9]{15})/i, // Direct 15-character hex pattern
          ];

          for (const pattern of patterns) {
            const match = description.match(pattern);
            if (match) {
              h3Index = match[1];
              console.log(
                "Found H3 index with pattern:",
                pattern,
                "->",
                h3Index
              );
              break;
            }
          }

          if (!h3Index) {
            console.log("No H3 index found in description:", description);
            return;
          }

          // Determine color from style
          const styleUrl =
            placemark.querySelector("styleUrl")?.textContent || "";
          const styleName =
            placemark.querySelector("Style name")?.textContent || "";
          console.log("Style info - URL:", styleUrl, "Name:", styleName);
          let color = "yellow"; // default

          if (
            styleUrl.includes("no-jamming") ||
            styleUrl.includes("transparent")
          ) {
            color = "green";
          } else if (styleUrl.includes("low") || styleUrl.includes("yellow")) {
            color = "yellow";
          } else if (
            styleUrl.includes("moderate") ||
            styleUrl.includes("orange")
          ) {
            color = "orange";
          } else if (styleUrl.includes("high") || styleUrl.includes("red")) {
            color = "red";
          }
          console.log("Assigned color:", color);

          // Extract additional data from KML for ALL hexagons (including transparent)
          const name = placemark.querySelector("name")?.textContent || "";
          const coordinates =
            placemark.querySelector("coordinates")?.textContent || "";

          // Parse jamming intensity from description if available
          const intensityMatch = description.match(
            /Jamming Intensity:\s*(\d+)/i
          );
          const intensity = intensityMatch
            ? parseInt(intensityMatch[1])
            : this.getIntensityFromColor(color);

          // Parse vertex count if available
          const vertexMatch = description.match(/Vertices:\s*(\d+)/i);
          const vertexCount = vertexMatch ? parseInt(vertexMatch[1]) : null;

          // Create hexagon for ALL colors (including transparent)
          this.createHexagon(h3Index, color, {
            originalName: name,
            originalDescription: description,
            originalCoordinates: coordinates,
            originalStyleUrl: styleUrl,
            originalIntensity: intensity,
            originalVertexCount: vertexCount,
            // Store any additional placemark attributes
            originalAttributes: this.extractPlacemarkAttributes(placemark),
          });

          hexagonCount++;

          // Calculate bounds to fit view for ALL hexagons
          try {
            const boundary = this.h3.cellToBoundary(h3Index);
            boundary.forEach(([lat, lng]) => {
              if (!bounds) {
                bounds = L.latLngBounds([lat, lng], [lat, lng]);
              } else {
                bounds.extend([lat, lng]);
              }
            });
          } catch (error) {
            console.error("Error calculating bounds for", h3Index, error);
          }
        } catch (error) {
          console.error("Error parsing placemark:", error);
        }
      });

      console.log("Created", hexagonCount, "hexagons");

      // Fit map to show all loaded hexagons
      if (bounds && hexagonCount > 0) {
        this.map.fitBounds(bounds, { padding: [20, 20] });
        console.log("Map fitted to bounds:", bounds);
      } else {
        console.log("No valid hexagons to display");
      }
    } catch (error) {
      this.debugLog("Error parsing KML: " + error.message);
    }
  }

  saveEditedKMZ() {
    try {
      this.updateMapStatus("Generating KMZ...");

      if (this.hexagons.size === 0) {
        this.updateMapStatus("No hexagons to save");
        return;
      }

      // Use the jamming converter with original data preservation
      if (typeof JammingDataConverter !== "undefined") {
        const converter = new JammingDataConverter();
        const timestamp = new Date().toISOString().split("T")[0];
        const filename = `edited_jamming_${timestamp}.kmz`;

        // Generate KML with preserved original data
        const kmlContent = converter.generateKMLFromHexagons(
          this.hexagons,
          "Edited GPS Jamming Data"
        );

        // Create KMZ
        const zip = new JSZip();
        zip.file("doc.kml", kmlContent);

        zip.generateAsync({ type: "blob" }).then((kmzBlob) => {
          // Download the file
          const url = URL.createObjectURL(kmzBlob);
          const link = document.createElement("a");
          link.href = url;
          link.download = filename;
          link.style.display = "none";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);

          this.updateMapStatus(
            `Saved ${this.hexagons.size} hexagons to KMZ with original data preserved`
          );
        });
      } else {
        this.debugLog("JammingDataConverter not available");
      }
    } catch (error) {
      this.debugLog("Error saving KMZ: " + error.message);
      this.updateMapStatus("Error saving KMZ");
    }
  }

  getIntensityFromColor(color) {
    switch (color) {
      case "yellow":
        return 10;
      case "orange":
        return 30;
      case "red":
        return 60;
      default:
        return 0;
    }
  }

  resetMap() {
    this.hexagons.forEach((hexagon) => {
      this.map.removeLayer(hexagon.polygon);
    });
    this.hexagons.clear();
    this.updateMapStatus("Map reset");
    if (fileInput) {
      this.loadKMZFile(e.target.files[0]);
    }
  }

  updateMapStatus(message) {
    const statusElement = document.getElementById("mapStatus");
    if (statusElement) {
      statusElement.textContent =
        message || "Click on map to add/edit hexagons";
    }
  }
}

// Initialize map editor when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded, waiting for scripts...");

  // Wait a bit for all scripts to load
  setTimeout(() => {
    console.log("Initializing GPS Jamming Map Editor");
    window.mapEditor = new GPSJammingMapEditor();
  }, 200);
});
