/***
|Name|JSONEditorPlugin|
|Description|A GUI editor for JSON content in TiddlyWiki tiddlers. Companion plugin for innerTW5Plugin.|
|Version|0.1|
|Source|https://github.com/wangyenshu/JSONEditorPlugin/blob/main/JSONEditorPlugin.js|
|Author|YanshuWang, with the help of AI|
|License|MIT|
|~CoreVersion|2.x|
!Installation:
Add {{{jsonEdit}}} to [[ToolbarCommands]].
***/
//{{{
// Ensure config.extensions.JSONEditor is defined for proper namespacing
if (!config.extensions.JSONEditor) {
    config.extensions.JSONEditor = {};
}

(function() { // Start of a closure for local aliases and variables

    var JSONEditor = config.extensions.JSONEditor; // Alias for our plugin's namespace

    /*
    ** Helper Functions (Namespaced within JSONEditor)
    */

    // JSONEditor.tryParseJSON: Safely parses a JSON string. Returns null if invalid or not an object/array.
    JSONEditor.tryParseJSON = function(jsonString) {
        if (!jsonString) {
            return null; // Handle empty or null strings directly
        }
        try {
            var o = JSON.parse(jsonString);
            // Ensure it's an object or array, not just a primitive like "null" or "123"
            if (typeof o === "object" && o !== null) {
                return o;
            }
        } catch (e) {
            // Parsing failed, return null
        }
        return null;
    };

    // JSONEditor.addPropertyField: Adds a new key-value input pair to the editor GUI
    // This function is also used for existing properties now.
    JSONEditor.addPropertyField = function(wrapper, key, value, isNewProperty) {
        key = key || "newProperty";
        value = value || "";
        isNewProperty = isNewProperty === true; // Ensure boolean

        var fieldContainer = createTiddlyElement(wrapper, "div", null, "jsonEditorField");

        // Key Input
        var keyLabel = createTiddlyElement(fieldContainer, "label", null, "jsonEditorLabel jsonEditorKeyLabel");
        keyLabel.textContent = "Key:";
        var keyInput = createTiddlyElement(keyLabel, "input", null, "jsonEditorKeyInput");
        keyInput.type = "text";
        keyInput.value = key;
        if (!isNewProperty) {
            keyInput.setAttribute("readonly", "readonly"); // Make existing keys non-editable to simplify
            keyInput.className += " jsonEditorKeyInputReadonly";
        }
        keyInput.setAttribute("data-json-key-field", "true"); // Mark as key input

        // Value Input
        var valueInput;
        // Determine input type based on value, if not new property
        if (!isNewProperty) {
            if (typeof value === 'string' && (value.length > 50 || value.indexOf('\n') !== -1)) {
                valueInput = createTiddlyElement(fieldContainer, "textarea", null, "jsonEditorInput jsonEditorTextarea");
                valueInput.value = value;
                valueInput.style.height = "60px"; // Default height for existing long textareas
            } else if (typeof value === 'boolean') {
                valueInput = createTiddlyElement(fieldContainer, "input", null, "jsonEditorInput jsonEditorCheckbox");
                valueInput.type = "checkbox";
                valueInput.checked = value;
            } else if (typeof value === 'number') {
                valueInput = createTiddlyElement(fieldContainer, "input", null, "jsonEditorInput jsonEditorNumber");
                valueInput.type = "number";
                valueInput.value = value;
            } else if (value === null) {
                valueInput = createTiddlyElement(fieldContainer, "input", null, "jsonEditorInput jsonEditorNull");
                valueInput.type = "text";
                valueInput.value = "null";
            } else if (typeof value === 'object') {
                valueInput = createTiddlyElement(fieldContainer, "textarea", null, "jsonEditorInput jsonEditorObject");
                valueInput.value = JSON.stringify(value, null, 2); // Still pretty-print for in-editor display
                valueInput.style.height = "100px";
            } else {
                valueInput = createTiddlyElement(fieldContainer, "input", null, "jsonEditorInput jsonEditorText");
                valueInput.type = "text";
                valueInput.value = String(value);
            }
        } else {
            // For new properties, default to a textarea with smaller initial height
            valueInput = createTiddlyElement(fieldContainer, "textarea", null, "jsonEditorInput jsonEditorTextarea");
            valueInput.value = value;
            valueInput.style.height = "30px";
        }

        valueInput.setAttribute("data-json-value-field", "true"); // Mark as value input

        // Delete button
        var deleteButton = createTiddlyButton(fieldContainer, "X", "Remove this property", function() {
            wrapper.removeChild(fieldContainer);
        }, "jsonEditorDeleteButton");

        fieldContainer.appendChild(keyLabel); // Append key label (which contains key input)
        fieldContainer.appendChild(valueInput); // Then value input
        fieldContainer.appendChild(deleteButton); // Add delete button at the end
    };


    /*
    ** JSON Editor Macro (config.macros.jsonEdit)
    */
    config.macros.jsonEdit = {
        handler: function(place, macroName, params, wikifier, paramString, tiddler) {
            var jsonString = tiddler.text || ""; // Get tiddler's main text content, default to empty string
            var data = JSONEditor.tryParseJSON(jsonString); // Use namespaced helper

            if (!data) {
                // If invalid or empty JSON, display a simple textarea for manual editing
                var msg = createTiddlyElement(place, "p");
                msg.className = "jsonEditorErrorMessage";
                msg.innerHTML = "<strong>Error:</strong> This tiddler's 'text' content does not contain valid JSON (must be an object or array). Displaying as plain text.<br>Please enter valid JSON to use the GUI editor.";

                var textArea = createTiddlyElement(place, "textarea", null, "jsonEditorFallbackTextArea");
                textArea.value = jsonString; // Show whatever content was there (even if 'undefined' from source)
                textArea.style.width = "100%";
                textArea.style.height = config.options.txtEasyEditorHeight || "500px"; // Reuse EasyEdit height option
                textArea.setAttribute("edit", "text"); // Mark for saving: specifically target the 'text' property
                return;
            }

            // --- Valid JSON detected, render GUI editor ---
            var wrapper = createTiddlyElement(place, "div", null, "jsonEditorWrapper");
            wrapper.setAttribute("jsonEdit", "text"); // Custom attribute to identify this editor for gathering data, always 'text'

            // Add button for adding new properties
            var addButtonContainer = createTiddlyElement(wrapper, "div", null, "jsonEditorAddButtonContainer");
            var addBtn = createTiddlyButton(addButtonContainer, "Add Property", "Add a new key-value pair", function() {
                JSONEditor.addPropertyField(wrapper, "", "", true); // Add new empty field, mark as new
            }, "jsonEditorAddButton");

            // Render existing properties
            for (var key in data) {
                if (data.hasOwnProperty(key)) {
                    JSONEditor.addPropertyField(wrapper, key, data[key], false); // Pass key, value, and false for isNewProperty
                }
            }
        },

        // gather: Collects data from the GUI and converts back to JSON
        gather: function(element) {
            var jsonEditAttr = element.getAttribute("jsonEdit");
            if (jsonEditAttr) {
                var newData = {};
                var isValid = true; // Flag for overall validity

                // Iterate over all field containers to gather both existing and new properties
                var fieldContainers = element.querySelectorAll(".jsonEditorField");
                fieldContainers.forEach(function(container) {
                    var keyInput = container.querySelector(".jsonEditorKeyInput");
                    var valueInput = container.querySelector(".jsonEditorInput[data-json-value-field='true']");

                    if (keyInput && valueInput) {
                        var key = keyInput.value.trim();
                        var value = JSONEditor._parseInputValue(valueInput, key); // Use namespaced helper
                        if (value === undefined) isValid = false; // Flag if parsing failed

                        if (key) { // Only add if key is not empty
                            if (newData.hasOwnProperty(key)) {
                                displayMessage("Warning: Duplicate key '" + key + "' found. Only the first instance will be saved.");
                            } else {
                                newData[key] = value;
                            }
                        }
                    }
                });

                if (!isValid) {
                    displayMessage("Some values were not valid. Please check the JSON editor.");
                }

                return JSON.stringify(newData); // Compact JSON output
            } else {
                // If it's the fallback textarea (for invalid initial JSON)
                var textArea = element.querySelector(".jsonEditorFallbackTextArea");
                if (textArea) {
                    return textArea.value; // Return the content of the raw textarea
                }
            }
            return null;
        }
    };

    /*
    ** Internal Helper for Parsing Input Values (within JSONEditor namespace)
    */
    JSONEditor._parseInputValue = function(inputElement, keyName) {
        var value;
        if (inputElement.classList.contains("jsonEditorCheckbox")) {
            value = inputElement.checked;
        } else if (inputElement.classList.contains("jsonEditorNumber")) {
            value = parseFloat(inputElement.value);
            if (isNaN(value) && inputElement.value !== "") {
                displayMessage("Warning: Value for '" + keyName + "' is not a valid number. Saving as string.");
                value = inputElement.value; // Fallback to string
            }
        } else if (inputElement.classList.contains("jsonEditorNull")) {
            value = (inputElement.value.toLowerCase() === "null") ? null : inputElement.value;
        } else if (inputElement.classList.contains("jsonEditorObject")) {
            value = JSONEditor.tryParseJSON(inputElement.value); // Use namespaced helper
            if (value === null && inputElement.value !== "") {
                displayMessage("Warning: Value for '" + keyName + "' is not valid JSON. Saving as plain string.");
                value = inputElement.value; // Fallback to string
            }
        } else {
            value = inputElement.value; // For plain text inputs (includes new property values)
        }
        return value;
    };


    /*
    ** Hijacking Story.prototype.gatherSaveFields
    */

    // 1. Backup the original function in the same namespace
    Story.prototype.gatherSaveFields_JSONEditor = Story.prototype.gatherSaveFields;

    // 2. Overwrite the original
    Story.prototype.gatherSaveFields = function(e, fields) {
        // First, invoke the original gatherSaveFields
        Story.prototype.gatherSaveFields_JSONEditor.apply(this, arguments);

        // Then, add our custom gathering logic if our editor is present
        // The 'f' attribute should always be 'text' for this specific plugin.
        if (e && e.getAttribute) {
            var f = e.getAttribute("jsonEdit");
            if (f === "text") { // Explicitly check for 'text' field
                var newVal = config.macros.jsonEdit.gather(e);
                if (newVal !== null) { // Only update if gather returned a non-null value
                    fields[f] = newVal;
                }
            }
        }
    };

    /*
    ** JSON Editor Command (config.commands.jsonEdit)
    */
    config.commands.jsonEdit = {
        text: "edit JSON",
        tooltip: "Edit this tiddler's content as JSON in a GUI",
        readOnlyText: "view JSON",
        readOnlyTooltip: "View the JSON source of this tiddler",
        handler: function(event, src, title) {
            clearMessage();
            // Pass 'text' as the parameter to the template, indicating we want to edit the 'text' field.
            story.displayTiddler(null, title, "JsonEditTemplate", false, null, "text"); // Note: template name still 'JsonEditTemplate'
            return false;
        }
    };

})(window.jQuery); // End of closure, using window.jQuery if available, otherwise just ()

/*
** Shadow Tiddlers and Stylesheets
*/

// Modify the ViewTemplate to add a "edit JSON" button next to the "edit" button
// This is outside the closure as it modifies a global config object directly.
config.shadowTiddlers.ViewTemplate = config.shadowTiddlers.ViewTemplate.replace(/\+editTiddler/, "+editTiddler jsonEdit");

// Create the JsonEditTemplate by modifying the default EditTemplate
// This tells TiddlyWiki to use our 'jsonEdit' macro instead of the default 'edit' macro
// for the 'text' field when the JsonEditTemplate is active.
// Keep the template name as 'JsonEditTemplate' for compatibility with existing references
config.shadowTiddlers.JsonEditTemplate = config.shadowTiddlers.EditTemplate.replace(/macro='edit text'/g, "macro='jsonEdit text'");

// Optional: Stylesheet for the JSON editor GUI
config.shadowTiddlers.JsonEditorStyleSheet = "/*{{{*/\n";
config.shadowTiddlers.JsonEditorStyleSheet += ".jsonEditorWrapper { margin: 1em 0; padding: 10px; border: 1px solid #ddd; background-color: #f9f9f9; box-shadow: 1px 1px 3px rgba(0,0,0,0.1); }\n";
config.shadowTiddlers.JsonEditorStyleSheet += ".jsonEditorField { margin-bottom: 8px; display: flex; align-items: flex-start; gap: 5px; }\n"; /* Added gap for spacing */
config.shadowTiddlers.JsonEditorStyleSheet += ".jsonEditorKeyLabel { flex-shrink: 0; display: flex; align-items: center; gap: 5px; }\n"; /* For key input */
config.shadowTiddlers.JsonEditorStyleSheet += ".jsonEditorKeyInput { flex-grow: 1; padding: 6px 8px; border: 1px solid #bbb; border-radius: 4px; font-family: monospace; font-size: 0.9em; }\n";
config.shadowTiddlers.JsonEditorStyleSheet += ".jsonEditorKeyInputReadonly { background-color: #eee; cursor: not-allowed; }\n"; /* Style for readonly keys */
config.shadowTiddlers.JsonEditorStyleSheet += ".jsonEditorLabel { font-weight: bold; margin-right: 10px; min-width: 120px; color: #333; padding-top: 5px; }\n";
config.shadowTiddlers.JsonEditorStyleSheet += ".jsonEditorInput { flex-grow: 1; padding: 6px 8px; border: 1px solid #bbb; border-radius: 4px; font-family: monospace; font-size: 0.9em; box-shadow: inset 0 1px 2px rgba(0,0,0,0.05); }\n";
config.shadowTiddlers.JsonEditorStyleSheet += ".jsonEditorInput:focus, .jsonEditorKeyInput:focus { border-color: #5cb3fd; outline: none; box-shadow: 0 0 5px rgba(82,168,236,0.5); }\n";
config.shadowTiddlers.JsonEditorStyleSheet += ".jsonEditorTextarea { resize: vertical; min-height: 60px; **width: 100px;** }\n"; /* CRITICAL CHANGE */
config.shadowTiddlers.JsonEditorStyleSheet += ".jsonEditorCheckbox { margin-left: 0; margin-top: 8px; transform: scale(1.2); }\n";
config.shadowTiddlers.JsonEditorStyleSheet += ".jsonEditorFallbackTextArea { /* Styles for the raw text fallback area */ }\n";
config.shadowTiddlers.JsonEditorStyleSheet += ".jsonEditorErrorMessage { color: #D8000C; background-color: #FFBABA; border: 1px solid #D8000C; padding: 8px; margin-bottom: 10px; border-radius: 4px; }\n";
config.shadowTiddlers.JsonEditorStyleSheet += ".jsonEditorAddButtonContainer { margin-bottom: 10px; text-align: right; }\n";
config.shadowTiddlers.JsonEditorStyleSheet += ".jsonEditorAddButton { background-color: #4CAF50; color: white; padding: 8px 15px; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9em; }\n";
config.shadowTiddlers.JsonEditorStyleSheet += ".jsonEditorAddButton:hover { background-color: #45a049; }\n";
config.shadowTiddlers.JsonEditorStyleSheet += ".jsonEditorDeleteButton { background-color: #f44336; color: white; padding: 5px 10px; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8em; margin-left: 5px; line-height: 1; }\n";
config.shadowTiddlers.JsonEditorStyleSheet += ".jsonEditorDeleteButton:hover { background-color: #da190b; }\n";
config.shadowTiddlers.JsonEditorStyleSheet += "/*}}}*/";

store.addNotification("JsonEditorStyleSheet", refreshStyles);

//}}}
