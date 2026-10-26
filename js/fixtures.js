// Generated from masjidmapper spec/fixtures/prayer. The fixtures are the spec: do not hand-edit times.
window.FIXTURES = {
 "source": "masjidmapper spec/fixtures/prayer (days.json, hijri.json), copied verbatim",
 "days": {
  "no masjid": {
   "name": "no masjid",
   "input": {
    "latitude": 43.6532,
    "longitude": -79.3832,
    "method": "ISNA",
    "madhab": "hanafi",
    "zone": "America/Toronto",
    "date": "2026-01-14",
    "masjid": null
   },
   "expected": {
    "rows": [
     {
      "salah": "fajr",
      "starts": "2026-01-14T11:24:00Z",
      "iqamah": null,
      "jummah": []
     },
     {
      "salah": "sunrise",
      "starts": "2026-01-14T12:48:00Z",
      "iqamah": null,
      "jummah": []
     },
     {
      "salah": "dhuhr",
      "starts": "2026-01-14T17:28:00Z",
      "iqamah": null,
      "jummah": []
     },
     {
      "salah": "asr",
      "starts": "2026-01-14T20:23:00Z",
      "iqamah": null,
      "jummah": []
     },
     {
      "salah": "maghrib",
      "starts": "2026-01-14T22:05:00Z",
      "iqamah": null,
      "jummah": []
     },
     {
      "salah": "isha",
      "starts": "2026-01-14T23:30:00Z",
      "iqamah": null,
      "jummah": []
     }
    ]
   }
  },
  "fixed iqamah for every prayer": {
   "name": "fixed iqamah for every prayer",
   "input": {
    "latitude": 43.6532,
    "longitude": -79.3832,
    "method": "ISNA",
    "madhab": "hanafi",
    "zone": "America/Toronto",
    "date": "2026-01-14",
    "masjid": {
     "name": "Masjid An-Nur",
     "latitude": 43.589,
     "longitude": -79.6441,
     "iqamah": {
      "fajr": "06:45",
      "dhuhr": "12:44",
      "asr": "15:35",
      "maghrib": "17:12",
      "isha": "18:46"
     },
     "maghribOffsetMinutes": null,
     "jummah": [],
     "calcMethodOverride": null
    }
   },
   "expected": {
    "rows": [
     {
      "salah": "fajr",
      "starts": "2026-01-14T11:24:00Z",
      "iqamah": {
       "at": "2026-01-14T11:45:00Z",
       "flagged": false
      },
      "jummah": []
     },
     {
      "salah": "sunrise",
      "starts": "2026-01-14T12:48:00Z",
      "iqamah": null,
      "jummah": []
     },
     {
      "salah": "dhuhr",
      "starts": "2026-01-14T17:28:00Z",
      "iqamah": {
       "at": "2026-01-14T17:44:00Z",
       "flagged": false
      },
      "jummah": []
     },
     {
      "salah": "asr",
      "starts": "2026-01-14T20:23:00Z",
      "iqamah": {
       "at": "2026-01-14T20:35:00Z",
       "flagged": false
      },
      "jummah": []
     },
     {
      "salah": "maghrib",
      "starts": "2026-01-14T22:05:00Z",
      "iqamah": {
       "at": "2026-01-14T22:12:00Z",
       "flagged": false
      },
      "jummah": []
     },
     {
      "salah": "isha",
      "starts": "2026-01-14T23:30:00Z",
      "iqamah": {
       "at": "2026-01-14T23:46:00Z",
       "flagged": false
      },
      "jummah": []
     }
    ]
   }
  },
  "friday jummah slots sorted": {
   "name": "friday jummah slots sorted",
   "input": {
    "latitude": 43.6532,
    "longitude": -79.3832,
    "method": "ISNA",
    "madhab": "hanafi",
    "zone": "America/Toronto",
    "date": "2026-10-09",
    "masjid": {
     "name": "Masjid An-Nur",
     "latitude": 43.589,
     "longitude": -79.6441,
     "iqamah": {},
     "maghribOffsetMinutes": null,
     "jummah": [
      "14:00",
      "13:15"
     ],
     "calcMethodOverride": null
    }
   },
   "expected": {
    "rows": [
     {
      "salah": "fajr",
      "starts": "2026-10-09T10:06:00Z",
      "iqamah": null,
      "jummah": []
     },
     {
      "salah": "sunrise",
      "starts": "2026-10-09T11:25:00Z",
      "iqamah": null,
      "jummah": []
     },
     {
      "salah": "dhuhr",
      "starts": "2026-10-09T17:06:00Z",
      "iqamah": null,
      "jummah": [
       "2026-10-09T17:15:00Z",
       "2026-10-09T18:00:00Z"
      ]
     },
     {
      "salah": "asr",
      "starts": "2026-10-09T20:58:00Z",
      "iqamah": null,
      "jummah": []
     },
     {
      "salah": "maghrib",
      "starts": "2026-10-09T22:44:00Z",
      "iqamah": null,
      "jummah": []
     },
     {
      "salah": "isha",
      "starts": "2026-10-10T00:03:00Z",
      "iqamah": null,
      "jummah": []
     }
    ]
   }
  }
 },
 "hijri": [
  {
   "name": "2026-1-01",
   "input": {
    "date": "2026-01-01",
    "offset": 0
   },
   "expected": {
    "formatted": "12 Rajab 1447"
   }
  },
  {
   "name": "2026-2-01",
   "input": {
    "date": "2026-02-01",
    "offset": 0
   },
   "expected": {
    "formatted": "13 Sha’ban 1447"
   }
  },
  {
   "name": "2026-3-01",
   "input": {
    "date": "2026-03-01",
    "offset": 0
   },
   "expected": {
    "formatted": "12 Ramadan 1447"
   }
  },
  {
   "name": "2026-4-01",
   "input": {
    "date": "2026-04-01",
    "offset": 0
   },
   "expected": {
    "formatted": "13 Shawwal 1447"
   }
  },
  {
   "name": "2026-5-01",
   "input": {
    "date": "2026-05-01",
    "offset": 0
   },
   "expected": {
    "formatted": "14 Dhu al-Qi’dah 1447"
   }
  },
  {
   "name": "2026-6-01",
   "input": {
    "date": "2026-06-01",
    "offset": 0
   },
   "expected": {
    "formatted": "15 Dhu al-Hijjah 1447"
   }
  },
  {
   "name": "2026-7-01",
   "input": {
    "date": "2026-07-01",
    "offset": 0
   },
   "expected": {
    "formatted": "16 Muharram 1448"
   }
  },
  {
   "name": "2026-8-01",
   "input": {
    "date": "2026-08-01",
    "offset": 0
   },
   "expected": {
    "formatted": "18 Safar 1448"
   }
  },
  {
   "name": "2026-9-01",
   "input": {
    "date": "2026-09-01",
    "offset": 0
   },
   "expected": {
    "formatted": "19 Rabi’ al-Awwal 1448"
   }
  },
  {
   "name": "2026-10-01",
   "input": {
    "date": "2026-10-01",
    "offset": 0
   },
   "expected": {
    "formatted": "20 Rabi’ al-Thani 1448"
   }
  },
  {
   "name": "2026-11-01",
   "input": {
    "date": "2026-11-01",
    "offset": 0
   },
   "expected": {
    "formatted": "21 Jumada al-Ula 1448"
   }
  },
  {
   "name": "2026-12-01",
   "input": {
    "date": "2026-12-01",
    "offset": 0
   },
   "expected": {
    "formatted": "21 Jumada al-Akhirah 1448"
   }
  },
  {
   "name": "2027-02-07 offset 0",
   "input": {
    "date": "2027-02-07",
    "offset": 0
   },
   "expected": {
    "formatted": "30 Sha’ban 1448"
   }
  },
  {
   "name": "2027-02-08 offset 0",
   "input": {
    "date": "2027-02-08",
    "offset": 0
   },
   "expected": {
    "formatted": "1 Ramadan 1448"
   }
  },
  {
   "name": "2027-03-09 offset 0",
   "input": {
    "date": "2027-03-09",
    "offset": 0
   },
   "expected": {
    "formatted": "1 Shawwal 1448"
   }
  },
  {
   "name": "2026-06-16 offset 0",
   "input": {
    "date": "2026-06-16",
    "offset": 0
   },
   "expected": {
    "formatted": "1 Muharram 1448"
   }
  },
  {
   "name": "mihrab mockup date",
   "input": {
    "date": "2026-10-05",
    "offset": 0
   },
   "expected": {
    "formatted": "24 Rabi’ al-Thani 1448"
   }
  }
 ]
};
