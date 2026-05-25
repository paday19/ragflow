from fastapi import FastAPI

from fastapi.middleware.cors import CORSMiddleware



from app.config import get_settings

from app.database import init_db

from app.routers import auth, chat, health, history, knowledge_cards, practice, stats, subjects, wrong_book



settings = get_settings()



app = FastAPI(title="RAGFlow Review Assistant API", version="1.0.0")



app.add_middleware(

    CORSMiddleware,

    allow_origins=settings.cors_origin_list,

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],

)



app.include_router(auth.router, prefix="/api")

app.include_router(chat.router, prefix="/api")

app.include_router(health.router, prefix="/api")

app.include_router(subjects.router, prefix="/api")

app.include_router(knowledge_cards.router, prefix="/api")

app.include_router(practice.router, prefix="/api")

app.include_router(wrong_book.router, prefix="/api")

app.include_router(history.router, prefix="/api")

app.include_router(stats.router, prefix="/api")





@app.on_event("startup")

def on_startup():

    init_db()

