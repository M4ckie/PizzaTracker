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
  var d = new Date();
  var month = String(d.getMonth() + 1).padStart(2, "0");
  var day = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + month + "-" + day;
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
  var channelsCache = [];

  function loadChannelsForReminders() {
    fetch("/api/channels")
      .then(function(r) { return r.json(); })
      .then(function(data) { channelsCache = data; });
  }
  loadChannelsForReminders();

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
            var bakeNotesHtml = '';
            if (bk.notes) {
              bakeNotesHtml = '<div class="bake-notes" data-bake-id="' + bk.id + '">' +
                '<span class="bake-notes-text">' + escapeHtml(bk.notes) + '</span>' +
                '<button class="btn-icon bake-notes-edit" data-edit-bake-notes="' + bk.id + '" title="Edit notes">&#9998;</button>' +
                '</div>';
            } else {
              bakeNotesHtml = '<div class="bake-notes bake-notes-empty" data-bake-id="' + bk.id + '">' +
                '<button class="btn-link add-bake-note-btn" data-edit-bake-notes="' + bk.id + '">+ Add note</button>' +
                '</div>';
            }
            return '<div class="bake-entry">' +
              '<div class="bake-row">' +
              '<span>' + bk.baked_date + ' \u2014 ' + bk.quantity + ' pizza' + (bk.quantity > 1 ? 's' : '') + ferment + '</span>' +
              '<button class="btn-icon" data-delete-bake="' + bk.id + '" title="Remove">\u00D7</button>' +
              '</div>' +
              bakeNotesHtml +
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
          '<input type="text" class="notes-input notes-input-sm bake-notes-input" placeholder="Bake notes (optional)" />' +
          '</div>';
      }

      var notesHtml = b.notes
        ? '<p class="batch-notes">' + escapeHtml(b.notes) + '</p>'
        : '';

      // Reminder section
      var reminderHtml = "";
      if (b.remaining > 0) {
        reminderHtml += '<div class="reminder-section">';
        if (channelsCache.length === 0) {
          reminderHtml += '<p class="reminder-none">Set up a channel in <a href="/settings">Settings</a> first</p>';
        } else {
          // Reminder form
          var defaultDate = new Date();
          defaultDate.setDate(defaultDate.getDate() + 3);
          defaultDate.setHours(10, 0, 0, 0);
          var dtVal = defaultDate.getFullYear() + "-" +
            String(defaultDate.getMonth() + 1).padStart(2, "0") + "-" +
            String(defaultDate.getDate()).padStart(2, "0") + "T10:00";
          var defaultMsg = "Your " + b.count + "x " + b.size_inches + '" ' + b.thickness + " dough from " + b.made_date + " is ready to bake!";

          reminderHtml += '<div class="reminder-form">';
          reminderHtml += '<select class="select-input reminder-channel" data-batch-id="' + b.id + '">';
          for (var ci = 0; ci < channelsCache.length; ci++) {
            var ch = channelsCache[ci];
            reminderHtml += '<option value="' + ch.id + '">' + ch.label + ' (' + ch.platform + ')</option>';
          }
          reminderHtml += '</select>';
          reminderHtml += '<input type="datetime-local" class="date-input reminder-datetime" data-batch-id="' + b.id + '" value="' + dtVal + '" />';
          reminderHtml += '<input type="text" class="notes-input reminder-msg" data-batch-id="' + b.id + '" value="' + defaultMsg.replace(/"/g, '&quot;') + '" />';
          reminderHtml += '<button class="btn btn-sm btn-primary set-reminder-btn" data-batch-id="' + b.id + '">Set Reminder</button>';
          reminderHtml += '</div>';
        }

        // Show existing unsent reminders
        var unsent = (b.reminders || []).filter(function(r) { return !r.sent; });
        if (unsent.length > 0) {
          reminderHtml += '<div class="batch-reminders">';
          for (var ri = 0; ri < unsent.length; ri++) {
            var rem = unsent[ri];
            var remDate = new Date(rem.remind_at).toLocaleString();
            reminderHtml += '<div class="reminder-row">';
            reminderHtml += '<span>' + remDate + '</span>';
            reminderHtml += '<button class="btn-icon delete-reminder-btn" data-reminder-id="' + rem.id + '" title="Delete reminder">&times;</button>';
            reminderHtml += '</div>';
          }
          reminderHtml += '</div>';
        }
        reminderHtml += '</div>';
      }

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
        reminderHtml +
        '</div>';
    }).join("");

    // Attach log-bake listeners
    batchesList.querySelectorAll(".log-bake-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var form = btn.closest(".log-bake-form");
        var batchId = form.getAttribute("data-batch-id");
        var qty = parseInt(form.querySelector(".bake-qty").value, 10);
        var dateVal = form.querySelector(".bake-date").value;
        var notes = form.querySelector(".bake-notes-input").value.trim() || null;
        logBake(batchId, qty, dateVal, notes);
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

    // Attach edit-bake-notes listeners
    batchesList.querySelectorAll("[data-edit-bake-notes]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var bakeId = btn.getAttribute("data-edit-bake-notes");
        var container = batchesList.querySelector('.bake-notes[data-bake-id="' + bakeId + '"]');
        if (!container || container.querySelector(".bake-notes-editor")) return;
        var currentText = "";
        var textEl = container.querySelector(".bake-notes-text");
        if (textEl) currentText = textEl.textContent;
        container.innerHTML = '<div class="bake-notes-editor">' +
          '<input type="text" class="notes-input notes-input-sm bake-notes-edit-input" value="' + escapeHtml(currentText) + '" />' +
          '<button class="btn btn-primary btn-sm bake-notes-save-btn">Save</button>' +
          '<button class="btn btn-sm bake-notes-cancel-btn">Cancel</button>' +
          '</div>';
        var input = container.querySelector(".bake-notes-edit-input");
        input.focus();
        container.querySelector(".bake-notes-save-btn").addEventListener("click", function () {
          saveBakeNotes(bakeId, input.value.trim());
        });
        container.querySelector(".bake-notes-cancel-btn").addEventListener("click", function () {
          loadBatches();
        });
        input.addEventListener("keydown", function (e) {
          if (e.key === "Enter") saveBakeNotes(bakeId, input.value.trim());
          if (e.key === "Escape") loadBatches();
        });
      });
    });

    // Attach set-reminder listeners
    document.querySelectorAll(".set-reminder-btn").forEach(function(btn) {
      btn.addEventListener("click", function() {
        var batchId = btn.getAttribute("data-batch-id");
        var channelSelect = document.querySelector('.reminder-channel[data-batch-id="' + batchId + '"]');
        var dtInput = document.querySelector('.reminder-datetime[data-batch-id="' + batchId + '"]');
        var msgInput = document.querySelector('.reminder-msg[data-batch-id="' + batchId + '"]');
        if (!channelSelect || !dtInput || !msgInput) return;
        fetch("/api/reminders", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            batch_id: parseInt(batchId),
            channel_id: parseInt(channelSelect.value),
            remind_at: dtInput.value,
            message: msgInput.value
          })
        })
        .then(function(r) {
          if (!r.ok) return r.json().then(function(d) { throw new Error(d.error || "Failed"); });
          loadBatches();
        })
        .catch(function(err) { alert("Error: " + err.message); });
      });
    });

    // Attach delete-reminder listeners
    document.querySelectorAll(".delete-reminder-btn").forEach(function(btn) {
      btn.addEventListener("click", function() {
        if (!confirm("Delete this reminder?")) return;
        var remId = btn.getAttribute("data-reminder-id");
        fetch("/api/reminders/" + remId, { method: "DELETE" })
          .then(function() { loadBatches(); });
      });
    });
  }

  function saveBakeNotes(bakeId, notes) {
    fetch("/api/bakes/" + encodeURIComponent(bakeId), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notes || null })
    })
      .then(function (resp) {
        if (!resp.ok) {
          return resp.json().then(function (d) { throw new Error(d.error || "Failed"); });
        }
        loadBatches();
      })
      .catch(function (err) {
        alert("Error: " + err.message);
      });
  }

  function logBake(batchId, quantity, dateStr, notes) {
    fetch("/api/batches/" + encodeURIComponent(batchId) + "/bakes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: quantity, baked_date: dateStr, notes: notes })
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
// Settings page
// =========================================================

function initSettings() {
  var platformSelect = document.getElementById("channel-platform");
  if (!platformSelect) return;

  var telegramFields = document.getElementById("telegram-fields");
  var discordFields  = document.getElementById("discord-fields");

  // Platform toggle
  platformSelect.addEventListener("change", function () {
    if (platformSelect.value === "telegram") {
      telegramFields.hidden = false;
      discordFields.hidden  = true;
    } else {
      telegramFields.hidden = true;
      discordFields.hidden  = false;
    }
  });

  var channelsList  = document.getElementById("channels-list");
  var channelsEmpty = document.getElementById("channels-empty");

  function loadChannels() {
    fetch("/api/channels")
      .then(function (resp) { return resp.json(); })
      .then(function (channels) {
        if (channels.length === 0) {
          channelsEmpty.hidden   = false;
          channelsList.hidden    = true;
          channelsList.innerHTML = "";
          return;
        }

        channelsEmpty.hidden = true;
        channelsList.hidden  = false;

        channelsList.innerHTML = channels.map(function (ch) {
          return '<div class="channel-item">' +
            '<div class="channel-info">' +
              '<span class="channel-label">' + escapeHtml(ch.label) + '</span>' +
              '<span class="channel-platform-badge">' + escapeHtml(ch.platform) + '</span>' +
            '</div>' +
            '<div class="channel-actions">' +
              '<span class="channel-test-result" id="test-result-' + ch.id + '"></span>' +
              '<button class="btn btn-sm btn-primary" data-test-channel="' + ch.id + '">Test</button>' +
              '<button class="btn-icon batch-delete" data-delete-channel="' + ch.id + '" title="Delete">&times;</button>' +
            '</div>' +
          '</div>';
        }).join("");

        // Event delegation for test and delete buttons
        channelsList.addEventListener("click", function (e) {
          var testBtn   = e.target.closest("[data-test-channel]");
          var deleteBtn = e.target.closest("[data-delete-channel]");

          if (testBtn) {
            var testId     = testBtn.getAttribute("data-test-channel");
            var resultSpan = document.getElementById("test-result-" + testId);
            fetch("/api/channels/" + encodeURIComponent(testId) + "/test", { method: "POST" })
              .then(function (resp) {
                if (!resp.ok) {
                  return resp.json().then(function (d) { throw new Error(d.error || "Test failed"); });
                }
                return resp.json();
              })
              .then(function () {
                resultSpan.textContent = "Sent!";
                resultSpan.style.color = "green";
                setTimeout(function () { resultSpan.textContent = ""; }, 3000);
              })
              .catch(function (err) {
                resultSpan.textContent = err.message;
                resultSpan.style.color = "red";
                setTimeout(function () { resultSpan.textContent = ""; }, 3000);
              });
          }

          if (deleteBtn) {
            var deleteId = deleteBtn.getAttribute("data-delete-channel");
            if (!window.confirm("Delete this channel?")) return;
            fetch("/api/channels/" + encodeURIComponent(deleteId), { method: "DELETE" })
              .then(function (resp) {
                if (!resp.ok) {
                  return resp.json().then(function (d) { throw new Error(d.error || "Delete failed"); });
                }
                loadChannels();
              })
              .catch(function (err) {
                alert("Error: " + err.message);
              });
          }
        });
      })
      .catch(function () {
        channelsList.innerHTML = '<p class="loading-cell">Failed to load channels.</p>';
      });
  }

  // Look up Chat ID button
  var tgLookupBtn    = document.getElementById("tg-lookup-btn");
  var tgBotToken     = document.getElementById("tg-bot-token");
  var tgLookupResult = document.getElementById("tg-lookup-result");
  var tgChatId       = document.getElementById("tg-chat-id");

  if (tgLookupBtn) {
    tgLookupBtn.addEventListener("click", function () {
      var token = tgBotToken.value.trim();
      if (!token) {
        tgLookupResult.textContent = "Enter a bot token first";
        return;
      }

      fetch("/api/telegram/updates?bot_token=" + encodeURIComponent(token))
        .then(function (resp) { return resp.json(); })
        .then(function (data) {
          var seen    = {};
          var chats   = [];
          var results = data.result || [];
          for (var i = 0; i < results.length; i++) {
            var msg = results[i].message;
            if (msg && msg.chat) {
              var chat = msg.chat;
              if (!seen[chat.id]) {
                seen[chat.id] = true;
                chats.push({ id: chat.id, name: chat.first_name || chat.title || String(chat.id) });
              }
            }
          }

          if (chats.length === 0) {
            tgLookupResult.textContent = "No chats found. Send your bot a message first.";
            return;
          }

          tgLookupResult.innerHTML = chats.map(function (c) {
            return '<span style="cursor:pointer;text-decoration:underline;margin-right:8px;" data-chat-id="' + c.id + '">' +
              'Chat: ' + escapeHtml(c.name) + ' (ID: ' + c.id + ')' +
            '</span>';
          }).join("");

          tgLookupResult.querySelectorAll("[data-chat-id]").forEach(function (span) {
            span.addEventListener("click", function () {
              tgChatId.value = span.getAttribute("data-chat-id");
            });
          });
        })
        .catch(function () {
          tgLookupResult.textContent = "Failed to look up chat ID";
        });
    });
  }

  // Add Channel button
  var addChannelBtn   = document.getElementById("add-channel-btn");
  var channelLabel    = document.getElementById("channel-label");
  var channelFeedback = document.getElementById("channel-feedback");

  if (addChannelBtn) {
    addChannelBtn.addEventListener("click", function () {
      var platform = platformSelect.value;
      var label    = channelLabel.value.trim();

      if (!label) {
        channelFeedback.textContent = "Label is required";
        channelFeedback.style.color = "red";
        return;
      }

      var config;
      if (platform === "telegram") {
        config = {
          bot_token: document.getElementById("tg-bot-token").value,
          chat_id:   document.getElementById("tg-chat-id").value
        };
      } else {
        config = {
          webhook_url: document.getElementById("dc-webhook-url").value
        };
      }

      fetch("/api/channels", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ platform: platform, label: label, config: config })
      })
        .then(function (resp) {
          if (!resp.ok) {
            return resp.json().then(function (d) { throw new Error(d.error || "Add failed"); });
          }
          return resp.json();
        })
        .then(function () {
          channelLabel.value = "";
          if (document.getElementById("tg-bot-token"))   document.getElementById("tg-bot-token").value   = "";
          if (document.getElementById("tg-chat-id"))     document.getElementById("tg-chat-id").value     = "";
          if (document.getElementById("dc-webhook-url")) document.getElementById("dc-webhook-url").value = "";
          channelFeedback.textContent = "Channel added!";
          channelFeedback.style.color = "green";
          loadChannels();
        })
        .catch(function (err) {
          channelFeedback.textContent = err.message;
          channelFeedback.style.color = "red";
        });
    });
  }

  loadChannels();
}

// =========================================================
// Entry point
// =========================================================

document.addEventListener("DOMContentLoaded", function () {
  initCalculator();
  initBatches();
  initSettings();
});
