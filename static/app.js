"use strict";

// =========================================================
// Utility
// =========================================================

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// =========================================================
// Calculator page
// =========================================================

function initCalculator() {
  var sizeSlider      = document.getElementById("size-slider");
  var countSlider     = document.getElementById("count-slider");
  var thicknessSelect = document.getElementById("thickness-select");
  var gfToggle        = document.getElementById("gf-toggle");
  var sizeDisplay     = document.getElementById("size-display");
  var countDisplay    = document.getElementById("count-display");
  var resultsSubtitle = document.getElementById("results-subtitle");
  var resultsBody     = document.getElementById("results-body");
  var ballWeightNote  = document.getElementById("ball-weight-note");
  var saveBatchBtn    = document.getElementById("save-batch-btn");
  var batchNotes      = document.getElementById("batch-notes");
  var saveFeedback    = document.getElementById("save-feedback");
  var madeDate        = document.getElementById("made-date");

  if (!sizeSlider) return;

  madeDate.value = todayStr();

  // Collapsible instructions
  var instructionsToggle = document.getElementById("instructions-toggle");
  var instructionsBody   = document.getElementById("instructions-body");
  var instructionsRegular = document.getElementById("instructions-regular");
  var instructionsGf      = document.getElementById("instructions-gf");

  instructionsToggle.addEventListener("click", function () {
    var expanded = instructionsToggle.getAttribute("aria-expanded") === "true";
    instructionsToggle.setAttribute("aria-expanded", String(!expanded));
    instructionsBody.hidden = expanded;
  });

  function updateInstructions() {
    var isGf = gfToggle.checked;
    instructionsRegular.hidden = isGf;
    instructionsGf.hidden = !isGf;
  }

  function updateDisplays() {
    sizeDisplay.textContent  = sizeSlider.value + '"';
    countDisplay.textContent = countSlider.value;
  }

  function buildSubtitle() {
    var size      = sizeSlider.value;
    var count     = countSlider.value;
    var thickness = thicknessSelect.value;
    var gf        = gfToggle.checked ? " GF" : "";
    return "For " + count + " \u00D7 " + size + '"' + " " + capitalize(thickness) + gf + " pizza" + (count > 1 ? "s" : "");
  }

  var fetchTimeout = null;

  function scheduleCalculate() {
    clearTimeout(fetchTimeout);
    fetchTimeout = setTimeout(fetchCalculation, 120);
  }

  function fetchCalculation() {
    var size      = sizeSlider.value;
    var count     = countSlider.value;
    var thickness = thicknessSelect.value;
    var gf        = gfToggle.checked ? "true" : "false";

    if (resultsSubtitle) resultsSubtitle.textContent = buildSubtitle();

    var url = "/api/calculate?size=" + encodeURIComponent(size) +
              "&count=" + encodeURIComponent(count) +
              "&thickness=" + encodeURIComponent(thickness) +
              "&gluten_free=" + encodeURIComponent(gf);

    fetch(url)
      .then(function (resp) {
        if (!resp.ok) {
          return resp.json().then(function (d) { throw new Error(d.error || "Request failed"); });
        }
        return resp.json();
      })
      .then(function (data) {
        renderResults(data);
      })
      .catch(function (err) {
        resultsBody.innerHTML = '<tr><td colspan="2" class="loading-cell">Error: ' + err.message + '</td></tr>';
        ballWeightNote.textContent = "";
      });
  }

  function renderResults(data) {
    var rows = [
      [data.flour_type, data.flour],
      ["Water",         data.water],
      ["Yeast",         data.yeast],
      ["Salt",          data.salt],
      ["Sugar",         data.sugar],
      ["Olive Oil",     data.olive_oil],
    ];

    resultsBody.innerHTML = rows.map(function (row) {
      return "<tr><td>" + row[0] + "</td><td>" + row[1] + "</td></tr>";
    }).join("");

    ballWeightNote.textContent = "Each dough ball: " + data.ball_weight + "g";
  }

  // Save batch
  saveBatchBtn.addEventListener("click", function () {
    var size      = parseInt(sizeSlider.value, 10);
    var count     = parseInt(countSlider.value, 10);
    var thickness = thicknessSelect.value;
    var gf        = gfToggle.checked;
    var notes     = batchNotes.value.trim() || null;
    var made      = madeDate.value || null;

    if (!made) {
      saveFeedback.textContent = "Please enter the date you made the dough.";
      saveFeedback.className   = "save-feedback error";
      return;
    }

    saveBatchBtn.disabled = true;
    clearFeedback();

    fetch("/api/batches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        size_inches: size,
        count:       count,
        thickness:   thickness,
        gluten_free: gf,
        notes:       notes,
        made_date:   made
      })
    })
      .then(function (resp) {
        if (!resp.ok) {
          return resp.json().then(function (d) { throw new Error(d.error || "Save failed"); });
        }
        return resp.json();
      })
      .then(function () {
        saveFeedback.textContent = "Batch saved!";
        saveFeedback.className   = "save-feedback";
        batchNotes.value         = "";
        madeDate.value           = todayStr();
        setTimeout(clearFeedback, 3000);
      })
      .catch(function (err) {
        saveFeedback.textContent = "Error: " + err.message;
        saveFeedback.className   = "save-feedback error";
      })
      .finally(function () {
        saveBatchBtn.disabled = false;
      });
  });

  function clearFeedback() {
    saveFeedback.textContent = "";
    saveFeedback.className   = "save-feedback";
  }

  sizeSlider.addEventListener("input", function () {
    updateDisplays();
    scheduleCalculate();
  });

  countSlider.addEventListener("input", function () {
    updateDisplays();
    scheduleCalculate();
  });

  thicknessSelect.addEventListener("change", scheduleCalculate);

  gfToggle.addEventListener("change", function () {
    updateInstructions();
    scheduleCalculate();
  });

  updateDisplays();
  updateInstructions();
  fetchCalculation();
}

// =========================================================
// Batches page
// =========================================================

function initBatches() {
  var statTotal      = document.getElementById("stat-total");
  var statPizzas     = document.getElementById("stat-pizzas-baked");
  var statLastMade   = document.getElementById("stat-last-made");
  var statLastBaked  = document.getElementById("stat-last-baked");
  var batchesList    = document.getElementById("batches-list");
  var batchesEmpty   = document.getElementById("batches-empty");

  if (!batchesList) return;

  function loadStats() {
    fetch("/api/batches/stats")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        statTotal.textContent     = data.total_batches;
        statPizzas.textContent    = data.total_pizzas_baked;
        statLastMade.textContent  = data.last_made_date || "None";
        statLastBaked.textContent = data.last_baked_date || "None";
      })
      .catch(function () {
        statTotal.textContent     = "-";
        statPizzas.textContent    = "-";
        statLastMade.textContent  = "-";
        statLastBaked.textContent = "-";
      });
  }

  function loadBatches() {
    fetch("/api/batches")
      .then(function (r) { return r.json(); })
      .then(function (batches) {
        renderBatches(batches);
      })
      .catch(function () {
        batchesList.innerHTML = '<div class="card"><p class="loading-cell">Failed to load batches.</p></div>';
      });
  }

  function renderBatches(batches) {
    if (batches.length === 0) {
      batchesEmpty.hidden = false;
      batchesList.innerHTML = "";
      return;
    }

    batchesEmpty.hidden = true;

    batchesList.innerHTML = batches.map(function (b) {
      var gfTag = b.gluten_free ? ' <span class="gf-badge">GF</span>' : "";
      var recipe = b.count + " \u00D7 " + b.size_inches + '" ' + capitalize(b.thickness) + gfTag;

      // Status
      var statusClass, statusText;
      if (b.fully_baked) {
        statusClass = "status-done";
        statusText = "All baked";
      } else if (b.baked_count > 0) {
        statusClass = "status-partial";
        statusText = b.remaining + " remaining";
      } else {
        statusClass = "status-unbaked";
        statusText = b.days_since_made + "d old \u2014 " + b.remaining + " unbaked";
      }

      // Bake history rows
      var bakesHtml = "";
      if (b.bakes.length > 0) {
        bakesHtml = '<div class="bake-history">' +
          b.bakes.map(function (bk) {
            var ferment = "";
            if (b.made_date && bk.baked_date) {
              var d1 = new Date(b.made_date);
              var d2 = new Date(bk.baked_date);
              var days = Math.round((d2 - d1) / 86400000);
              ferment = ' <span class="text-muted">(' + days + 'd ferment)</span>';
            }
            return '<div class="bake-row">' +
              '<span>' + bk.baked_date + ' \u2014 ' + bk.quantity + ' pizza' + (bk.quantity > 1 ? 's' : '') + ferment + '</span>' +
              '<button class="btn-icon" data-delete-bake="' + bk.id + '" title="Remove">\u00D7</button>' +
              '</div>';
          }).join("") +
          '</div>';
      }

      // Log bake form (only if remaining > 0)
      var logBakeHtml = "";
      if (b.remaining > 0) {
        var qtyOptions = "";
        for (var i = 1; i <= b.remaining; i++) {
          qtyOptions += '<option value="' + i + '">' + i + '</option>';
        }
        logBakeHtml = '<div class="log-bake-form" data-batch-id="' + b.id + '">' +
          '<select class="select-input select-sm bake-qty">' + qtyOptions + '</select>' +
          '<span class="text-muted">pizza' + (b.remaining > 1 ? 's' : '') + ' on</span>' +
          '<input type="date" class="date-input date-input-sm bake-date" value="' + todayStr() + '" />' +
          '<button class="btn btn-primary btn-sm log-bake-btn">Log Bake</button>' +
          '</div>';
      }

      var notesHtml = b.notes
        ? '<p class="batch-notes">' + escapeHtml(b.notes) + '</p>'
        : '';

      return '<div class="card batch-card ' + (b.fully_baked ? 'batch-done' : '') + '">' +
        '<div class="batch-header">' +
          '<div class="batch-info">' +
            '<span class="batch-recipe">' + recipe + '</span>' +
            '<span class="batch-made">Made ' + escapeHtml(b.made_date) + '</span>' +
          '</div>' +
          '<div class="batch-status-area">' +
            '<span class="batch-status ' + statusClass + '">' + statusText + '</span>' +
            '<button class="btn-icon batch-delete" data-delete-batch="' + b.id + '" title="Delete batch">\u00D7</button>' +
          '</div>' +
        '</div>' +
        notesHtml +
        bakesHtml +
        logBakeHtml +
        '</div>';
    }).join("");

    // Attach log-bake listeners
    batchesList.querySelectorAll(".log-bake-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var form = btn.closest(".log-bake-form");
        var batchId = form.getAttribute("data-batch-id");
        var qty = parseInt(form.querySelector(".bake-qty").value, 10);
        var dateVal = form.querySelector(".bake-date").value;
        logBake(batchId, qty, dateVal);
      });
    });

    // Attach delete-batch listeners
    batchesList.querySelectorAll("[data-delete-batch]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-delete-batch");
        if (!window.confirm("Delete this entire batch and all its bake records?")) return;
        deleteBatch(id);
      });
    });

    // Attach delete-bake listeners
    batchesList.querySelectorAll("[data-delete-bake]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-delete-bake");
        if (!window.confirm("Remove this bake entry?")) return;
        deleteBake(id);
      });
    });
  }

  function logBake(batchId, quantity, dateStr) {
    fetch("/api/batches/" + encodeURIComponent(batchId) + "/bakes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: quantity, baked_date: dateStr })
    })
      .then(function (resp) {
        if (!resp.ok) {
          return resp.json().then(function (d) { throw new Error(d.error || "Failed"); });
        }
        loadStats();
        loadBatches();
      })
      .catch(function (err) {
        alert("Error: " + err.message);
      });
  }

  function deleteBatch(id) {
    fetch("/api/batches/" + encodeURIComponent(id), { method: "DELETE" })
      .then(function (resp) {
        if (resp.status === 204) {
          loadStats();
          loadBatches();
        } else {
          alert("Failed to delete batch.");
        }
      })
      .catch(function () {
        alert("Network error — batch not deleted.");
      });
  }

  function deleteBake(id) {
    fetch("/api/bakes/" + encodeURIComponent(id), { method: "DELETE" })
      .then(function (resp) {
        if (resp.ok) {
          loadStats();
          loadBatches();
        } else {
          alert("Failed to remove bake.");
        }
      })
      .catch(function () {
        alert("Network error.");
      });
  }

  loadStats();
  loadBatches();
}

// =========================================================
// Entry point
// =========================================================

document.addEventListener("DOMContentLoaded", function () {
  initCalculator();
  initBatches();
});
