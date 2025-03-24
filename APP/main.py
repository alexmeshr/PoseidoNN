import json
import pandas as pd
from PIL import Image
from loguru import logger
import sys
from typing import List

from fastapi import FastAPI, File, status, UploadFile, BackgroundTasks
from fastapi.responses import RedirectResponse
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from io import BytesIO
import os
import uuid
import time
import itertools

from app import get_image_from_bytes
from app import detect_sample_model
from app import add_bboxs_on_img
from app import get_bytes_from_image

app = FastAPI(
    title="Object Detection FastAPI Template",
    description="""Obtain object value out of image
                    and return image and json result""",
    version="2023.1.31",
)

app.mount("/static", StaticFiles(directory="frontend_build/static"), name="static")

# This function is needed if you want to allow client requests
# from specific domains (specified in the origins argument) 
# to access resources from the FastAPI server, 
# and the client and server are hosted on different domains.
origins = [
    "http://localhost",
    "http://localhost:8008",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def save_openapi_json():
    '''This function is used to save the OpenAPI documentation 
    data of the FastAPI application to a JSON file. 
    The purpose of saving the OpenAPI documentation data is to have 
    a permanent and offline record of the API specification, 
    which can be used for documentation purposes or 
    to generate client libraries. It is not necessarily needed, 
    but can be helpful in certain scenarios.'''
    openapi_data = app.openapi()
    # Change "openapi.json" to desired filename
    with open("openapi.json", "w") as file:
        json.dump(openapi_data, file)


# redirect

# Раздача index.html при доступе к корню
@app.get("/")
async def serve_frontend():
    return FileResponse("frontend_build/index.html")


@app.get('/healthcheck', status_code=status.HTTP_200_OK)
def perform_healthcheck():
    '''
    It basically sends a GET request to the route & hopes to get a "200"
    response code. Failing to return a 200 response code just enables
    the GitHub Actions to rollback to the last version the project was
    found in a "working condition". It acts as a last line of defense in
    case something goes south.
    Additionally, it also returns a JSON response in the form of:
    {
        'healtcheck': 'Everything OK!'
    }
    '''
    return {'healthcheck': 'Everything OK!'}


task_progress = {}

def fake_object_detection(image_data: bytes, task_id: str, img_index:int, total_imgs: int):
    print(total_imgs)
    time.sleep(img_index*0.2)  # Имитация задержки для детекции
    print(task_progress[task_id]["progress"])
    # Добавляем фейковые объекты
    task_progress[task_id]["results"][img_index].extend([
                {"class": "Cat", "bbox": [50, 50, 200, 200]},
                {"class": "Dog", "bbox": [300, 100, 450, 350]},
            ])
    task_progress[task_id]["processed"] += 1
    task_progress[task_id]["progress"] = int((task_progress[task_id]["processed"] / total_imgs) * 100)
    if task_progress[task_id]["processed"] == total_imgs:
        task_progress[task_id]["done"] = True
        task_progress[task_id]["stats"] = calculate_stats(task_progress[task_id]["results"])

def calculate_stats(results):
    stats = {}
    all_objects = itertools.chain(*results)
    for obj in all_objects:
        class_name = obj["class"]
        stats[class_name] = stats.get(class_name, 0) + 1
    return stats

@app.post("/detect/")
async def detect_objects(background_tasks: BackgroundTasks, files: List[UploadFile] = File(...)):
    task_id = str(uuid.uuid4())
    task_progress[task_id] = {"progress": 0, "processed":0, "done": False, "stats": {}, "results":[[] for _ in range(len(files))]}

    for i in range(len(files)):
        image_data = await files[i].read()
        background_tasks.add_task(fake_object_detection, image_data, task_id, i, len(files))
    print(f"Get {len(files)} files, id={task_id}")
    return JSONResponse(content={"status": "processing", "task_id": task_id})

@app.get("/progress/{task_id}")
async def get_progress(task_id: str):
    print(f" task_progress of {task_id}: {task_progress[task_id]}")
    if task_id not in task_progress:
        return JSONResponse(status_code=404, content={"error": "Task not found"})

    return JSONResponse(content=task_progress[task_id])