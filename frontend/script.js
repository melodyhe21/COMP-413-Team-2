const API_BASE_URL = "http://localhost:5050"; 

function assignSurvey(surveyId) {
    const doctorUsernameInput = document.getElementById(`assign-doctor-${surveyId}`);
    const doctorUsername = doctorUsernameInput.value.trim();

    if (!doctorUsername) {
        alert("Please enter a Doctor's username.");
        return;
    }

    fetch(`${API_BASE_URL}/survey-assignments/username`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ survey_id: surveyId, username: doctorUsername })
    })
    .then(async res => {
        const contentType = res.headers.get("content-type");
    
        if (!res.ok) {
            const errorText = await res.text(); // try to get error body
            throw new Error(`Server responded with error: ${res.status} ${res.statusText}\n${errorText}`);
        }
    
        if (contentType && contentType.includes("application/json")) {
            return res.json();
        } else {
            throw new Error("Expected JSON, but got something else.");
        }
    })
    .then(data => {
        if (data.error) {
            alert(`Error: ${data.error}`);
        } else {
            alert(`✅ Assigned to Doctor ${doctorUsername}`);
        }
    })
    .catch(err => {
        console.error("Assignment error:", err.message);
        alert(`Assignment error: ${err.message}`);
    });
}


window.assignSurvey = assignSurvey;


document.addEventListener("DOMContentLoaded", function () {

    const addSurveyBtn = document.getElementById("add-survey-btn");

    if (addSurveyBtn) {
        addSurveyBtn.addEventListener("click", function () {
            window.location.href = "new_survey.html"; 
        });
    }

    document.getElementById("admin-login")?.addEventListener("click", function () {
        login("admin");
    });

    document.getElementById("doctor-login")?.addEventListener("click", function () {
        login("doctor");
    });

    function login(userType) {
        const username = document.getElementById("username")?.value.trim();
        const password = document.getElementById("password")?.value.trim();
      
        if (!username || !password) {
          alert("Please enter username and password.");
          return;
        }
      
        fetch(`${API_BASE_URL}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password, role: userType })
        })
        .then(response => response.json())
        .then(data => {
          if (data.error) {
            alert(data.error);
          } else {
            localStorage.setItem("user_id", data.id);
            localStorage.setItem("username", username);
            window.location.href = userType === "admin" ? "admin.html" : "doctor.html";
          }
        })
        .catch(err => console.error("Login error:", err));
      }
      

    function loadSurveys() {
        fetch(`${API_BASE_URL}/surveys`)
            .then(response => response.json())
            .then(surveys => {
                const container = document.getElementById("surveys-container");
                if (!container) return;
                container.innerHTML = "";
                surveys.forEach(survey => {
                    let li = document.createElement("li");
                    li.innerHTML = `
                        <strong>${survey.title}</strong> - ${survey.description} 
                        <button onclick="viewSurvey(${survey.id})">View</button>
                        <br>
                        <input type="text" id="assign-doctor-${survey.id}" placeholder="Doctor Username" style="margin-top:5px; margin-right:10px;">
                        <button onclick="assignSurvey(${survey.id})">Assign</button>
                    `;

                    container.appendChild(li);
                });
            })
            .catch(err => console.error("Error fetching surveys:", err));
    }

    

    document.getElementById("create-survey-btn")?.addEventListener("click", function () {
    const userName = localStorage.getItem("username");
    if (userName) {
        if (document.getElementById("adminName")) {
            document.getElementById("adminName").textContent = userName;
        }
        if (document.getElementById("doctorName")) {
            document.getElementById("doctorName").textContent = userName;
        }
    }

    const addSurveyBtn = document.getElementById("add-survey-btn");

    if (addSurveyBtn) {
        addSurveyBtn.addEventListener("click", function () {
            window.location.href = "new_survey.html";
        });
    }
});

    const surveyQuestionsContainer = document.getElementById("survey-questions");
    const addQuestionButton = document.getElementById("add-question-btn");
    const createSurveyButton = document.getElementById("create-survey-btn");
    const lesionContainer = document.getElementById("lesion-container");
    const lesionFilter = document.getElementById("lesion-filter");
    const lesionSelectionModal = document.getElementById('lesion-modal');
    const closeModal = document.getElementById('close-lesion-selection');
    const submitImage = document.getElementById('submit-image');
    let questions = [];
    let selectedLesion = null;

    // fetch the lesion images and display them
    function fetchLesions() {
        console.log("fetching");
        return fetch("http://localhost:5050/isic-images")
            .then(response => response.json())
            .then(data => {
                console.log('Fetched data:', data);
                return data;
            })
            .catch(error => {
                console.error("Error fetching lesion images:", error);
                return {}; 
            });
    }

    // display lesion images
    function displayImages(images) {
        lesionContainer.innerHTML = '';

        if (images.length === 0) {
            lesionContainer.innerHTML = "<p>No images found for the selected filter.</p>";
        }

        images.forEach(image => {
            const img = document.createElement('img');
            img.src = image.files.thumbnail_256.url;
            img.alt = image.attribution || 'No attribution available';
            img.classList.add('thumbnail');
            img.style.border = "3px transparent";
            img.addEventListener("click", () => selectImage(img));
            lesionContainer.appendChild(img);
        });
    };

    // handle image selection
    function selectImage(image) {
        if (selectedLesion) {
            selectedLesion.style.border = "3px transparent";
        }
        image.style.border = "3px solid blue";
        selectedLesion = image;
    };
    
    console.log(lesionFilter);
    // change lesion filter
    lesionFilter?.addEventListener("change", function () {
        console.log("changed");
        const filterValue = document.getElementById('lesion-filter').value;
        fetchLesions().then(data => {
            let filteredImages = data.results;

            // filter based on diagnosis_1 (Malignant or Benign)
            if (filterValue !== 'all') {
                filteredImages = filteredImages.filter(image => {
                    const diagnosis = image.metadata?.clinical?.diagnosis_1 || '';
                    return diagnosis.toLowerCase() === filterValue;
                });
            }

            // display the images in the modal after filtering
            displayImages(filteredImages);
            lesionSelectionModal.style.display = "block";
        });
    });

    // close image selection modal
    closeModal?.addEventListener("click", function () {
        lesionSelectionModal.style.display = "none";
    });

    // submit an image
    submitImage?.addEventListener("click", function () {
        if (!selectedLesion) {
            alert("Please select an image first.");
            return;
        }
    
        lesionSelectionModal.style.display = "none";
    
        const imgContainer = document.getElementById('lesion-image-container');
        imgContainer.innerHTML = '';
    
        // create and append the selected image
        const selectedImg = document.createElement('img');
        selectedImg.src = selectedLesion.src;
        selectedImg.alt = selectedLesion.alt || 'No attribution available';
        selectedImg.classList.add('selected-image');
        imgContainer.appendChild(selectedImg);
    
        // create and append the "Change Image" button
        const changeImg = document.createElement('button');
        changeImg.id = "change-image";
        changeImg.textContent = "Change Image";
        imgContainer.appendChild(changeImg);
    
        // add event listener to the "Change Image" button
        changeImg?.addEventListener("click", function () {
            lesionSelectionModal.style.display = "block"; // Show the image selection modal again
        });
    });

    addQuestionButton?.addEventListener("click", function () {
        let newQuestion = prompt("Enter your question:");
        if (newQuestion) {
            let questionDiv = document.createElement("div");
            questionDiv.classList.add("question");
            questionDiv.innerHTML = `<label>${newQuestion}</label>
                                     <input type="text" placeholder="Answer here">`;
            surveyQuestionsContainer.appendChild(questionDiv);
            questions.push(newQuestion);
        }
    });

    createSurveyButton?.addEventListener("click", function () {
        const title = document.getElementById("survey-title").value.trim();
        const description = document.getElementById("survey-desc").value.trim();
        const created_by = localStorage.getItem("user_id");

        if (!title || !description) {
            alert("Please enter survey title and description.");
            return;
        }

        fetch(`${API_BASE_URL}/surveys`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, description, created_by })
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
            } else {
                alert("Survey created successfully!");
                window.location.href = "admin.html";
            }
        })
        .catch(err => console.error("Error creating survey:", err));
    });

    function viewSurvey(surveyId) {
        localStorage.setItem("currentSurveyId", surveyId);
        window.location.href = "view_survey.html";
    }

    if (document.getElementById("survey-title") && document.getElementById("survey-desc")) {
        const surveyId = localStorage.getItem("currentSurveyId");
        fetch(`${API_BASE_URL}/questions?survey_id=${surveyId}`)
            .then(response => response.json())
            .then(questions => {
                document.getElementById("survey-questions").innerHTML = "";
                questions.forEach(q => {
                    let div = document.createElement("div");
                    div.innerHTML = `<label>${q.question_text}</label> <input type="text" id="q${q.id}">`;
                    document.getElementById("survey-questions").appendChild(div);
                });
            })
            .catch(err => console.error("Error fetching questions:", err));
    }

    document.getElementById("submit-survey-btn")?.addEventListener("click", function () {
        const surveyId = localStorage.getItem("currentSurveyId");
        const userId = localStorage.getItem("user_id");
        let responses = [];

        document.querySelectorAll("#survey-questions input").forEach(input => {
            let questionId = input.id.replace("q", "");
            responses.push({
                survey_id: surveyId,
                user_id: userId,
                question_id: questionId,
                response_text: input.value.trim()
            });
        });

        responses.forEach(response => {
            fetch(`${API_BASE_URL}/responses`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(response)
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    alert(data.error);
                } else {
                    alert("Response submitted successfully!");
                    window.location.href = "doctor.html";
                }
            })
            .catch(err => console.error("Error submitting response:", err));
        });
    });

    loadSurveys();

    if (document.getElementById("doctor-surveys")) {
        const doctorId = localStorage.getItem("user_id");
    
        fetch(`${API_BASE_URL}/survey-assignments/${doctorId}`)
            .then(res => res.json())
            .then(surveys => {
                const container = document.getElementById("doctor-surveys");
                container.innerHTML = "";
                surveys.forEach(survey => {
                    let li = document.createElement("li");
                    li.innerHTML = `<strong>${survey.title}</strong> - ${survey.description}
                                    <button onclick="fillSurvey(${survey.id})">Take Survey</button>`;
                    container.appendChild(li);
                });
            })
            .catch(err => console.error("Error loading assigned surveys:", err));
    }
});


document.addEventListener("DOMContentLoaded", function () {
    // debugging message
    console.log("DOM fully loaded. Waiting for user to start gaze tracking...");

    let gazeTrackingActive = false;

    const lesionImage = document.getElementById("lesion-image");
    const lesionContainer = document.getElementById("lesion-image-container");

    // debugging message
    if (!lesionImage) {
        console.error("Lesion image not found.");
    }
    if (!lesionContainer) {
        console.error("Lesion image container not found.");
    }

    // create heatmap instance for the image container
    const heatmapInstance = h337.create({
        container: lesionContainer,
        radius: 30,
        maxOpacity: 0.6,
        minOpacity: 0.2,
        blur: 0.75
    });
    console.log("Heatmap instance created on lesion container.");

    function startGazeTracking() {
        if (gazeTrackingActive) {
            console.log("Gaze tracking is already active.");
            return;
        }

        console.log("Starting GazeCloudAPI eye tracking...");
        GazeCloudAPI.StartEyeTracking();
        gazeTrackingActive = true;

        GazeCloudAPI.OnResult = function (GazeData) {
            console.log("Gaze data received:", GazeData);

            if (GazeData.state === 0) {
                let gazeX = GazeData.GazeX;
                let gazeY = GazeData.GazeY;


                console.log(`Absolute Gaze Coordinates: (${gazeX}, ${gazeY})`);

                // Get image bounding box
                const rect = lesionImage.getBoundingClientRect();
                const imgLeft = rect.left;
                const imgTop = rect.top;
                const imgRight = rect.right;
                const imgBottom = rect.bottom;


                console.log(`🖼 Lesion image bounds:
                    Left: ${imgLeft}, Top: ${imgTop}, Right: ${imgRight}, Bottom: ${imgBottom}`);

                // Check if gaze is within image
                if (gazeX >= imgLeft && gazeX <= imgRight && gazeY >= imgTop && gazeY <= imgBottom) {
                    const localX = gazeX - imgLeft;
                    const localY = gazeY - imgTop;

                    console.log(`Gaze is on the lesion image (local coords): (${localX}, ${localY})`);

                    heatmapInstance.addData({ x: localX, y: localY, value: 1 });
                } else {
                    console.log("Gaze is outside the lesion image.");
                }
            } else {
                console.log(`Gaze data state is not 0 (state = ${GazeData.state})`);
            }
        };

        GazeCloudAPI.OnError = function (error) {
            console.error("GazeCloudAPI Error:", error);
        };
    }

    function stopGazeTracking() {
        if (gazeTrackingActive) {
            console.log("Stopping GazeCloudAPI eye tracking...");
            GazeCloudAPI.StopEyeTracking();
            gazeTrackingActive = false;
        } else {
            console.log("Gaze tracking is not active.");
        }
    }

    document.getElementById("start-tracking-btn").addEventListener("click", startGazeTracking);
    document.getElementById("stop-tracking-btn").addEventListener("click", stopGazeTracking);
});
