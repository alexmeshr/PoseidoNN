# Инструкция для разработчиков:
## Инструкция по установке и запуску проекта (React + FastAPI)
### 0. Загрузка с GitHub
Склонируйте репозиторий с GitHub:
```
git clone https://github.com/alexmeshr/PoseidoNN.git
```
Перейдите в папку проекта:
```
cd PoseidoNN
```

### 1. Установка Python и создание окружения

#### Убедитесь, что установлен Python 3.10

Проверьте установленную версию Python:
```sh
python --version
```
или
```sh
python3 --version
```

Если Python 3.10 не установлен, скачайте и установите его с [официального сайта](https://www.python.org/downloads/).

#### Создание виртуального окружения

Создайте виртуальное окружение в корневой папке проекта:
```sh
python3 -m venv venv
```

Активируйте виртуальное окружение:
- Windows:
  ```sh
  venv\Scripts\activate
  ```
- macOS/Linux:
  ```sh
  source venv/bin/activate
  ```

### 2. Установка зависимостей

После активации виртуального окружения установите зависимости из `requirements.txt`:
```sh
pip install -r requirements.txt
```

### 3. Установка Node.js и npm

Проект использует React, поэтому необходимо установить Node.js и npm.

#### Проверка наличия Node.js и npm

Проверьте, установлены ли Node.js и npm:
```sh
node -v
npm -v
```

Если они не установлены, скачайте и установите Node.js (вместе с npm) с [официального сайта](https://nodejs.org/).

### 4. Установка и настройка фронтенда

Создайте новый React-проект с помощью npm:
```sh
npx create-react-app my_frontend
```

Перейдите в созданную папку проекта:
```sh
cd my_frontend
```

Скопируйте содержимое папки `app_frontend/src` в `my-app/src`, заменяя файлы.

Установите необходимые зависимости:
```sh
npm install axios 
```

### 5. Запуск проекта

#### Запуск бэкенда (FastAPI)
Вернитесь в корневую папку проекта и активируйте виртуальное окружение, если оно не активно:
```sh
source venv/bin/activate  # macOS/Linux
venv\Scripts\activate    # Windows
```

Запустите сервер FastAPI:
```sh
uvicorn main:app --reload
```
или
```sh
python main.py
```

(Если файл `main.py` находится в корне проекта.)

#### Запуск фронтенда (React)
Перейдите в папку с фронтендом и запустите сервер разработки:
```sh
cd my_frontend
npm start
```

Откройте [http://localhost:3000](http://localhost:3000) в браузере для просмотра фронтенда.


### 6. Дополнительные команды

- Остановка виртуального окружения:
  ```sh
  deactivate
  ```
- Остановка серверов (нажмите `Ctrl + C` в терминале).
- Сборка exe
- ```
  pyinstaller --onefile --add-data "frontend_build;frontend_build" --name poseidonn main.py
  ```

