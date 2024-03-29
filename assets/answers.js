const { raw_limit } = require('../config.json');

let answers = {
    "access_denied": {
        "ru": "Чтобы сделать это, нужны права администратора на сервере",
        "en": "To do this, you need administrator rights on the server",
        "uk": "Щоб зробити це, потрібні права адміністратора на сервері",
        "tr": "Bunu yapmak için sunucuda yönetici haklarına ihtiyacınız var."
    },
    "not_enough_data": {
        "ru": "Недостаточно данных для генерации...",
        "en": "Not enough data to generate...",
        "uk": "Недостатньо даних для генерації...",
        "tr": "Oluşturmak için yeterli veri yok..."
    },
    "flood_control": {
        "ru": "Слишком ты быстро, попробуй снова через %VAR% секунд",
        "en": "You're too fast, try again in %VAR% seconds",
        "uk": "Занадто ти швидко, спробуй знову через %VAR% секунд",
        "tr": "Çok hızlısınız, %VAR% saniye sonra tekrar deneyin"
    },
    "not_image": {
        "ru": "Это не фотография!",
        "en": "This is not a photograph!",
        "uk": "Це не фотографія!",
        "tr": "Bu bir fotoğraf değil!"
    },
    "delete": {
        "mention": {
            "ru": "Упоминание удалено из базы данных",
            "en": "Mention removed from database",
            "uk": "Згадка видалена з бази даних",
            "tr": "Bahsetme veritabanından kaldırıldı"
        },
        "string": {
            "ru": "Строка удалена из базы данных",
            "en": "Row removed from database",
            "uk": "Рядок видалено з бази даних",
            "tr": "Satır veritabanından kaldırıldı"
        }
    },
    "language": {
        "changed": {
            "ru": "Язык бота успешно изменен на %VAR%",
            "en": "Bot language successfully changed to %VAR%",
            "uk": "Мова робота успішно змінена на %VAR%",
            "tr": "Bot dili başarıyla %VAR% olarak değiştirildi"
        },
        "translate": {
            "ru": "Русский",
            "en": "English",
            "uk": "Український",
            "tr": "Türk"
        },
        "already": {
            "ru": "Язык и так уже %VAR%",
            "en": "The language is already %VAR%",
            "uk": "Мова і так уже %VAR%",
            "tr": "Dil zaten %VAR%"
        }
    },
    "gen": {
        "poem": {
            "ru": "от знаменитого писателя и философа Нейробалбеса",
            "en": "from the famous writer and philosopher Neurobalbes",
            "uk": "від знаменитого письменника та філософа Нейробалбеса",
            "tr": "ünlü yazar ve filozof Neurobalbes'ten"
        },
        "jokes": {
            "ru": [
                "Штирлиц шел по лесу, вдруг ему за пазуху упала гусеница.\n«%VAR%», подумал Штирлиц.",
                "Шел медведь по лесу\nСел в машину и — %VAR%",
                "Ебутся два клоуна, а один другому говорит: — «%VAR%»",
                "Заходит как—то улитка в бар\nА Бармен ей отвечает\nМы улиток не обслуживаем\nИ выпинывает ее за дверь\nЧерез неделю приходит улитка\nИ говорит: «%VAR%»",
                "— Извините, а у вас огоньку не найдется?\n— «%VAR%» — ответил медведь из машины",
                "В дверь постучали 8 раз.\n— «%VAR%», — догадался Штирлиц.",
                "— Скажите, Сергей, как вы поняли что в квартире находится кто—то чужой?\n— %VAR%"
            ],
            "en": [
                "Stirlitz was walking through the forest, suddenly a caterpillar fell into his bosom.\n%VAR%, Stirlitz thought.",
                "The bear was walking through the forest\nSit in the car and — %VAR%",
                "Two clowns are fucking, and one says to the other: — «%VAR%»",
                "Somehow a snail comes into a bar\nAnd the bartender answers it\nWe don't serve snails\nAnd kicks it out the door\nA week later a snail appears\nAnd says: «%VAR%»",
                "— Excuse me, but do you have a light?\n— «%VAR%» — answered the bear from the car",
                "They knocked on the door 8 times.\n— «%VAR%», Stirlitz guessed.",
                "— Tell me, Sergey, how did you understand that someone else was in the apartment?\n— %VAR%"
            ],
            "uk": [
                "Штірліц йшов лісом, раптом йому за пазуху впала гусениця.\n«%VAR%», подумав Штірліц.",
                "Ішов ведмідь лісом\nСів ​​у машину і — %VAR%",
                "Єбути два клоуни, а один одному каже: — «%VAR%»",
                "Заходить якось равлик у бар\nА Бармен їй відповідає\nМи равликів не обслуговуємо\nІ випинає її за двері\nЧерез тиждень піде равлик\nІ каже: «%VAR%»",
                "— Вибачте, а у вас вогнику не знайдеться? — %VAR% — відповів ведмідь з машини.",
                "У двері постукали 8 разів. — %VAR%, — здогадався Штірліц.",
                "— Скажіть, Сергію, як ви зрозуміли, що в квартирі знаходиться хтось чужий?\n— %VAR%"
            ],
            "tr": [
                "Stirlitz ormanda yürüyordu, aniden göğsüne bir tırtıl düştü.\n«%VAR%», diye düşündü Stirlitz.",
                "Ayı ormanda yürüyordu\nArabada oturun ve — %VAR%",
                "İki palyaço sevişiyor ve biri diğerine: — «%VAR%» diyor",
                "Her nasılsa bir salyangoz bara girer\nVe barmen cevap verir\nSalyangoz servisi yapmıyoruz\nVe onu kapıdan kovar\nBir hafta sonra bir salyangoz belirir\nVe «%VAR%» der",
                "— Afedersiniz ama ateşiniz var mı?\n— «%VAR%» — ayı arabadan cevap verdi",
                "Kapıyı 8 kez çaldılar.\n—«%VAR%», diye tahmin etti Stirlitz.",
                "— Söyle bana Sergey, dairede başka birinin olduğunu nasıl anladın?\n— %VAR%"
            ]
            
        }
    },
    "info": {
        "bot_silent": {
            "ru": "Сейчас бот молчит\nЧтобы он начал писать, введите %VAR%setting talk True",
            "en": "The bot is currently silent\nTo start writing, type %VAR%setting talk True",
            "uk": "Зараз бот мовчить\nЩоб він почав писати, введіть %VAR%setting talk True",
            "tr": "Bot şu anda sessiz\nYazmaya başlamak için %VAR%setting talk True yazın"
        },
        "default": {
            "ru": "обычный",
            "en": "default",
            "uk": "звичайний",
            "tr": "sıradan"
        },
        "literate": {
            "ru": "грамотный",
            "en": "literate",
            "uk": "грамотний",
            "tr": "okuryazar"
        },
        "mode": {
            "ru": "Режим генерации бота: %VAR%",
            "en": "Bot generation mode: %VAR%",
            "uk": "Режим створення бота: %VAR%",
            "tr": "Bot oluşturma modu: %VAR%"
        },
        "speed": {
            "ru": "Скорость генерации: %VAR%",
            "en": "Generation rate: %VAR%",
            "uk": "Швидкість генерації: %VAR%",
            "tr": "Üretim oranı: %VAR%"
        },
        "serverID": {
            "ru": "ID сервера: %VAR%",
            "en": "Server ID: %VAR%",
            "uk": "ID сервера: %VAR%",
            "tr": "Sunucu Kimliği: %VAR%"
        },
        "saved_count": {
            "ru": `сохранено строк %VAR%/${raw_limit}`,
            "en": `rows saved %VAR%/${raw_limit}`,
            "uk": `збережено строк %VAR%/${raw_limit}`,
            "tr": `kaydedilen satırlar %VAR%/${raw_limit}`
        },
        "saved_anti": {
            "ru": "запрещены для отправки %VAR%/1000",
            "en": "not allowed to send %VAR%/1000",
            "uk": "заборонені для відправлення %VAR%/1000",
            "tr": "gönderilmesine izin verilmiyor %VAR%/1000"  
        }
    },
    "setting": {
        "already": {
            "ru": "Значение уже является таким",
            "en": "The setting is already like this",
            "uk": "Налаштування вже таке",
            "tr": "Ayar zaten böyle"
        },
        "speed_changed": {
            "ru": "Скорость генерации сообщений сменена на %VAR%",
            "en": "Message generation rate changed to %VAR%",
            "uk": "Швидкість створення повідомлень змінена на %VAR%",
            "tr": "Mesaj oluşturma hızı %VAR% olarak değiştirildi"
        },
        "speed_wrong": {
            "ru": "Укажите вместе с командой, число (от 1 до 10), к примеру: %VAR%setting speed 4",
            "en": "Specify, along with the command, a number (from 1 to 10), for example: %VAR%setting speed 4",
            "uk": "Вкажіть разом із командою, число (від 1 до 10), наприклад: %VAR%setting speed 4",
            "tr": "Komutla birlikte bir sayı belirtin (1'den 10'a kadar), örneğin: %VAR%setting speed 4"
        },
        "genering_syntax": {
            "ru": "Теперь я буду генерировать грамотные фразы",
            "en": "Now I will generate literate phrases",
            "uk": "Тепер я буду генерувати грамотні фрази",
            "tr": "Şimdi okuryazar ifadeler üreteceğim"
        },
        "genering_default": {
            "ru": "Теперь я буду генерировать обычные фразы",
            "en": "Now I will generate common phrases",
            "uk": "Тепер я генеруватиму звичайні фрази",
            "tr": "Şimdi düzenli ifadeler üreteceğim"
        },
        "access_write": {
            "ru": "Вы разрешили мне писать",
            "en": "You let me write",
            "uk": "Ви дозволили мені писати",
            "tr": "Yazmama izin ver"
        },
        "denied_write": {
            "ru": "Вы запретили мне писать :(",
            "en": "You forbade me to write :(",
            "uk": "Ви заборонили мені писати :(",
            "tr": "Yazmamı yasakladın :("
        },
        "success_wipe": {
            "ru": "Все сообщения успешно удалены",
            "en": "All messages have been successfully deleted",
            "uk": "Всі повідомлення успішно видалено",
            "tr": "Tüm mesajlar başarıyla silindi"
        }
    },
    "voice": {
        "notinvoice": {
            "ru": "Вы не находитесь ни в одном голосовом канале",
            "en": "You are not in any voice channel",
            "uk": "Ви не знаходитесь в жодному голосовому каналі",
            "tr": "Herhangi bir ses kanalında değilsiniz"
        },
        "start_voice": {
            "ru": "Начинаю общение в **%VAR%**",
            "en": "Starting a conversation at **%VAR%**",
            "uk": "Починаю спілкування у **%VAR%**",
            "tr": "**%VAR%** ile görüşme başlatma"
        },
        "iam_notinvoice": {
            "ru": "Я не нахожусь ни в одном голосовом канале",
            "en": "I'm not in any voice channel",
            "uk": "Я не знаходжусь у жодному голосовому каналі",
            "tr": "Herhangi bir ses kanalında değilim"
        },
        "disconnect": {
            "ru": "Отключился от **%VAR%**",
            "en": "Disconnected from **%VAR%**",
            "uk": "Відключився від **%VAR%**",
            "tr": "**%VAR%** ile bağlantı kesildi"
        }
    },
}

module.exports.answers = answers;