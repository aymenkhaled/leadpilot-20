from flask import Flask, request, jsonify
from flask_cors import CORS
from jobspy import scrape_jobs
import traceback
import pandas as pd

app = Flask(__name__)
CORS(app)

SUPPORTED_SITES = ["linkedin", "indeed", "glassdoor", "google", "zip_recruiter"]

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy", "service": "jobspy"})

@app.route("/sites", methods=["GET"])
def sites():
    return jsonify({"sites": SUPPORTED_SITES})

@app.route("/scrape", methods=["POST"])
def scrape():
    try:
        data = request.get_json() or {}
        
        search_term = data.get("search_term", "")
        location = data.get("location", "")
        sites = data.get("sites", ["indeed", "google"])
        results_wanted = data.get("results_wanted", 20)
        hours_old = data.get("hours_old", 72)
        country_indeed = data.get("country_indeed", "USA")
        proxy = data.get("proxy")
        
        valid_sites = [s for s in sites if s in SUPPORTED_SITES]
        if not valid_sites:
            valid_sites = ["indeed", "google"]
        
        scrape_kwargs = {
            "site_name": valid_sites,
            "search_term": search_term,
            "location": location,
            "results_wanted": min(results_wanted, 100),
            "hours_old": hours_old,
            "country_indeed": country_indeed,
        }
        
        if proxy:
            scrape_kwargs["proxy"] = proxy
        
        print(f"[JobSpy] Scraping: {search_term} in {location} from {valid_sites}")
        
        jobs_df = scrape_jobs(**scrape_kwargs)
        
        jobs = []
        for _, row in jobs_df.iterrows():
            min_amt = row.get("min_amount")
            max_amt = row.get("max_amount")
            job = {
                "externalId": str(row.get("id", "")),
                "platform": str(row.get("site", "")).capitalize(),
                "title": str(row.get("title", "")),
                "description": str(row.get("description", ""))[:5000],
                "companyName": str(row.get("company", "")),
                "location": str(row.get("location", "")),
                "sourceUrl": str(row.get("job_url", "")),
                "budgetMin": int(min_amt) if min_amt is not None and not pd.isna(min_amt) else None,
                "budgetMax": int(max_amt) if max_amt is not None and not pd.isna(max_amt) else None,
                "budgetType": str(row.get("interval", "")) if row.get("interval") and not pd.isna(row.get("interval")) else None,
                "postedAt": str(row["date_posted"]) if row.get("date_posted") and not pd.isna(row.get("date_posted")) else None,
                "skills": [],
                "remote": bool(row.get("is_remote", False)) if not pd.isna(row.get("is_remote", False)) else False,
            }
            if job["title"]:
                jobs.append(job)
        
        print(f"[JobSpy] Found {len(jobs)} jobs")
        
        return jsonify({
            "success": True,
            "jobs": jobs,
            "count": len(jobs),
            "sites_scraped": valid_sites,
        })
        
    except Exception as e:
        print(f"[JobSpy] Error: {e}")
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e),
            "jobs": [],
            "count": 0,
        }), 500

if __name__ == "__main__":
    print("[JobSpy] Starting service on port 5001...")
    app.run(host="0.0.0.0", port=5001, debug=False)
