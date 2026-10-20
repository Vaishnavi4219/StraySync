// ========================================
// STRAYSYNC - HOMEPAGE JAVASCRIPT
// ========================================

// Automatically update the footer year.

const yearElement = document.getElementById("current-year");

if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
}


// Smooth scrolling for links pointing to sections
// on the current page.

document.querySelectorAll('a[href^="#"]').forEach((link) => {

    link.addEventListener("click", (event) => {

        const targetId = link.getAttribute("href");

        if (!targetId || targetId === "#") {
            return;
        }

        const targetElement = document.querySelector(targetId);

        if (targetElement) {
            event.preventDefault();

            targetElement.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }

    });

});


// Confirm that the homepage JavaScript loaded.

console.log("StraySync homepage JavaScript loaded successfully.");