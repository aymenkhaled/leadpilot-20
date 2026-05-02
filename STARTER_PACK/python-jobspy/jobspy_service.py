"""
JobSpy Microservice - Python Flask API for job scraping
Exposes JobSpy (python-jobspy) functionality via HTTP endpoints
"""

import json
import os
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Try to import jobspy, but handle gracefully if not installed
JOBSPY_AVAILABLE = False
try:
    from jobspy import scrape_jobs
    JOBSPY_AVAILABLE = True
    print("[JobSpy Service] python-jobspy loaded successfully")
except ImportError:
    print("[JobSpy Service] WARNING: python-jobspy not installed. Run: pip install python-jobspy")


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "ok",
        "jobspy_available": JOBSPY_AVAILABLE
    })


@app.route('/scrape', methods=['POST'])
def scrape():
    """
    Scrape jobs from multiple platforms using JobSpy
    
    Expected JSON body:
    {
        "search_term": "software engineer",
        "location": "USA",
        "platforms": ["indeed", "linkedin", "glassdoor", "ziprecruiter"],
        "results_wanted": 25,
        "hours_old": 72
    }
    """
    if not JOBSPY_AVAILABLE:
        return jsonify({
            "success": False,
            "error": "JobSpy library not installed. Run: pip install python-jobspy",
            "jobs": []
        }), 503

    try:
        data = request.get_json() or {}
        
        search_term = data.get('search_term', 'software engineer')
        location = data.get('location', '')
        platforms = data.get('platforms', ['indeed', 'linkedin', 'glassdoor', 'ziprecruiter'])
        results_wanted = data.get('results_wanted', 25)
        hours_old = data.get('hours_old', 72)
        
        print(f"[JobSpy] Scraping: term='{search_term}', location='{location}', platforms={platforms}")
        
        # Call JobSpy with full descriptions enabled
        jobs_df = scrape_jobs(
            site_name=platforms,
            search_term=search_term,
            location=location,
            results_wanted=results_wanted,
            hours_old=hours_old,
            country_indeed="USA",
            linkedin_fetch_description=True,  # Fetch full LinkedIn descriptions
            verbose=2  # More logging
        )
        
        # Convert DataFrame to list of dicts
        jobs = []
        for _, row in jobs_df.iterrows():
            # Helper to handle NaN values properly
            def clean_str(val, max_len=None):
                if val is None:
                    return ""
                if isinstance(val, float) and val != val:  # Check for NaN
                    return ""
                result = str(val).strip()
                if result.lower() == "nan":
                    return ""
                if max_len:
                    result = result[:max_len]
                return result
            
            job = {
                "title": clean_str(row.get("title")),
                "description": clean_str(row.get("description"), 5000),
                "company_name": clean_str(row.get("company")),
                "location": clean_str(row.get("location")),
                "remote": bool(row.get("is_remote", False)),
                "platform": clean_str(row.get("site")) or "unknown",
                "external_id": clean_str(row.get("id")) or None,
                "source_url": clean_str(row.get("job_url")),
            }
            
            # Handle salary fields (may be NaN)
            try:
                salary_min = row.get("min_amount")
                if salary_min and not (isinstance(salary_min, float) and salary_min != salary_min):
                    job["budget_min"] = int(salary_min)
            except (ValueError, TypeError):
                pass
                
            try:
                salary_max = row.get("max_amount")
                if salary_max and not (isinstance(salary_max, float) and salary_max != salary_max):
                    job["budget_max"] = int(salary_max)
            except (ValueError, TypeError):
                pass
            
            # Only include jobs with valid titles
            if job["title"]:
                jobs.append(job)
        
        print(f"[JobSpy] Found {len(jobs)} jobs")
        
        return jsonify({
            "success": True,
            "jobs": jobs,
            "total": len(jobs)
        })
        
    except Exception as e:
        print(f"[JobSpy] Error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e),
            "jobs": []
        }), 500


if __name__ == '__main__':
    port = int(os.environ.get('JOBSPY_PORT', 5001))
    print(f"[JobSpy Service] Starting on port {port}")
    print(f"[JobSpy Service] JobSpy available: {JOBSPY_AVAILABLE}")
    app.run(host='0.0.0.0', port=port, debug=False)
