
window.addEventListener("load", function () {
    "use strict";

    var presentation = sozi.model.Presentation;
    var selection = sozi.editor.model.Selection.init(presentation);
    sozi.editor.view.Preview.init(presentation, selection);
    sozi.editor.view.Timeline.init(presentation, selection);
    sozi.editor.view.Properties.init(presentation, selection);
    
    var svgFileDescriptor;

    function htmlGenerator(svgData) {
        return function () {
            return nunjucks.render("templates/sozi.export.html", {
                svg: svgData,
                pres: presentation
            });
        };
    }

    sozi.editor.backend.list.forEach(function (backend) {
        var listItem = $("<li></li>");
        $("#sozi-editor-view-preview ul").append(listItem);
        backend
            .addListener("load", function (backend, fileDescriptor, data, err) {
                var name = backend.getName(fileDescriptor);
                var location = backend.getLocation(fileDescriptor);

                if (/\.svg$/.test(name)) {
                    if (!err) {
                        // Find the SVG root and check that the loaded document is valid SVG.
                        var svgRoot = $("#sozi-editor-view-preview").html(data).get(0).querySelector("svg");
                        if (svgRoot instanceof SVGSVGElement) {
                            svgFileDescriptor = fileDescriptor;
                            presentation.init(svgRoot);
                            $("html head title").text(presentation.title);
                            
                            var jsonName = name.replace(/\.svg$/, ".sozi.json");

                            backend.find(jsonName, location, function (fileDescriptor) {
                                if (fileDescriptor) {
                                    backend.load(fileDescriptor);
                                }
                                else {
                                    // If no JSON file is available, attempt to extract
                                    // presentation data from the SVG document, assuming
                                    // it has been generated from Sozi 13 or earlier.
                                    // Then save the extracted data to a JSON file.
                                    presentation.upgrade();
                                    
                                    // Select the first frame
                                    if (presentation.frames.length) {
                                        $.notify("Document was imported from Sozi 13 or earlier.", "success");
                                        selection.selectedFrames.push(presentation.frames.first);
                                    }
                                    
                                    backend.create(jsonName, location, "application/json", JSON.stringify(presentation.toStorable()), function (fileDescriptor) {
                                        setupAutosave(backend, fileDescriptor);
                                    });
                                }
                            });

                            // Always create an exported SVG file and set autosave
                            var htmlName = name.replace(/\.svg$/, ".sozi.html");
                            var htmlExporter = htmlGenerator(data);

                            backend.create(htmlName, location, "text/html", htmlExporter(), function (fileDescriptor) {
                                backend.autosave(fileDescriptor, htmlExporter);
                            });

                            backend.addListener("save", function (backend, fileDescriptor) {
                                $.notify("Saved " + backend.getName(fileDescriptor), "info");
                            });
                        }
                        else {
                            $.notify("Document is not valid SVG.", "error");
                        }
                    }
                    else {
                        $.notify("File " + name + " could not be loaded.", "error");
                    }
                }
                else if (/\.sozi\.json$/.test(name)) {
                    if (!err) {
                        // Load presentation data from JSON file.
                        presentation.fromStorable(JSON.parse(data));

                        // Select the first frame
                        if (presentation.frames.length) {
                            selection.selectedFrames.push(presentation.frames.first);
                        }

                        setupAutosave(backend, fileDescriptor);
                    }
                }
            })
            .addListener("change", function (backend, fileDescriptor) {
                if (fileDescriptor === svgFileDescriptor) {
                    $.notify("Document was changed. Reloading", "info");
                    backend.load(fileDescriptor);
                }
            })
            .init(listItem);
    });

    function setupAutosave(backend, fileDescriptor) {
        backend.autosave(fileDescriptor, function () {
            return JSON.stringify(presentation.toStorable());
        });
    }
}, false);
